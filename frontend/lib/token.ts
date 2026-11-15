import userPool from "./cognito";
import type { CognitoUserSession } from "amazon-cognito-identity-js";

/**
 * ID token de Cognito de la sesión actual, para el header `Authorization` de la API.
 * Primero lo toma de la cookie `cognitoIdToken`; si no está, se lo pide a la sesión de Cognito.
 * Devuelve `null` si no hay sesión (o si se ejecuta en el servidor).
 */
export async function obtenerTokenAuth(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  // Primero intentamos obtener el token de la cookie.
  const match = document.cookie.match(
    /(?:^|;\s*)cognitoIdToken=([^;]+)/
  );

  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  // Si no existe la cookie, consultamos la sesión de Cognito.
  const cognitoUser = userPool.getCurrentUser();

  if (!cognitoUser) {
    return null;
  }

  return new Promise((resolve) => {
    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (!err && session?.isValid()) {
          resolve(session.getIdToken().getJwtToken());
        } else {
          resolve(null);
        }
      }
    );
  });
}
