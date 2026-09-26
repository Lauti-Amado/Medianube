"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import userPool from "./cognito";

// ── Types ──────────────────────────────────────────────────────────────────

interface AuthUser {
  email: string;
  sub: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    attributes?: Record<string, string>
  ) => Promise<{ userConfirmed: boolean }>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Set or remove the auth cookie so Next.js middleware can read it server-side. */
function syncAuthCookie(session: CognitoUserSession | null) {
  if (session) {
    const token = session.getIdToken().getJwtToken();
    document.cookie = `cognitoIdToken=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
  } else {
    document.cookie =
      "cognitoIdToken=; path=/; max-age=0; SameSite=Lax";
  }
}

function extractUser(session: CognitoUserSession): AuthUser {
  const payload = session.getIdToken().decodePayload();
  return {
    email: (payload["email"] as string) ?? "",
    sub: (payload["sub"] as string) ?? "",
  };
}

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for an existing session on mount
  useEffect(() => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.getSession(
        (err: Error | null, session: CognitoUserSession | null) => {
          if (!err && session?.isValid()) {
            setUser(extractUser(session));
            syncAuthCookie(session);
          } else {
            syncAuthCookie(null);
          }
          setIsLoading(false);
        }
      );
    } else {
      syncAuthCookie(null);
      setIsLoading(false);
    }
  }, []);

  // ── Sign In ──────────────────────────────────────────────────────────────

  const signIn = useCallback(
    (email: string, password: string): Promise<void> =>
      new Promise((resolve, reject) => {
        const cognitoUser = new CognitoUser({
          Username: email,
          Pool: userPool,
        });
        const authDetails = new AuthenticationDetails({
          Username: email,
          Password: password,
        });

        cognitoUser.authenticateUser(authDetails, {
          onSuccess(session) {
            setUser(extractUser(session));
            syncAuthCookie(session);
            resolve();
          },
          onFailure(err) {
            reject(err);
          },
        });
      }),
    []
  );

  // ── Sign Up ──────────────────────────────────────────────────────────────

  const signUp = useCallback(
    (
      email: string,
      password: string,
      attributes: Record<string, string> = {}
    ): Promise<{ userConfirmed: boolean }> =>
      new Promise((resolve, reject) => {
        const attrList = Object.entries(attributes).map(
          ([key, value]) =>
            new CognitoUserAttribute({ Name: key, Value: value })
        );
        // Always include email as an attribute
        attrList.push(
          new CognitoUserAttribute({ Name: "email", Value: email })
        );

        userPool.signUp(email, password, attrList, [], (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            userConfirmed: result?.userConfirmed ?? false,
          });
        });
      }),
    []
  );

  // ── Confirm Sign Up ──────────────────────────────────────────────────────

  const confirmSignUp = useCallback(
    (email: string, code: string): Promise<void> =>
      new Promise((resolve, reject) => {
        const cognitoUser = new CognitoUser({
          Username: email,
          Pool: userPool,
        });
        cognitoUser.confirmRegistration(code, true, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }),
    []
  );

  // ── Sign Out ─────────────────────────────────────────────────────────────

  const signOut = useCallback(() => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    setUser(null);
    syncAuthCookie(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signUp,
        confirmSignUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
