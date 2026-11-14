"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Icon from "../../src/src/components/ui/Icon";
import Alert from "../../src/src/components/ui/Alert";
import Button from "../../src/src/components/ui/Button";
import { useAuth } from "../../lib/auth-context";

type Campo = "email" | "password";

interface ErrorLogin {
  texto: string;
  /** Campos que se marcan con borde de error. */
  campos: Campo[];
  /** Suma el link para recuperar la contraseña dentro del mensaje. */
  ofrecerRecuperar?: boolean;
}

// ── Inner component (needs useSearchParams inside Suspense) ────────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ErrorLogin | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      const vacios: Campo[] = [];
      if (!email.trim()) vacios.push("email");
      if (!password) vacios.push("password");
      setError({
        texto: vacios.length === 2 ? "ingresá tu email y tu contraseña." : vacios[0] === "email" ? "ingresá tu email." : "ingresá tu contraseña.",
        campos: vacios,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(email, password);
      const redirect = searchParams.get("redirect") || "/dashboard";
      router.push(redirect);
    } catch (err: unknown) {
      const cognitoError = err as { code?: string };
      switch (cognitoError.code) {
        case "UserNotConfirmedException":
          setError({ texto: "tu cuenta todavía no está confirmada. revisá tu email.", campos: [] });
          break;
        case "NotAuthorizedException":
          setError({ texto: "email o contraseña incorrectos. revisalos o", campos: ["email", "password"], ofrecerRecuperar: true });
          break;
        case "UserNotFoundException":
          setError({ texto: "no encontramos una cuenta con ese email.", campos: ["email"] });
          break;
        default:
          setError({ texto: "no pudimos iniciar sesión. probá de nuevo en unos segundos.", campos: [] });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      id="login-page"
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Card */}
      <div
        id="login-card"
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-2xl)",
          padding: "44px 40px 36px",
        }}
      >
        {/* Brand mark */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            marginBottom: "28px",
          }}
        >
          <div
            id="login-logo"
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "9999px",
              border: "2px solid var(--color-border-strong)",
              backgroundColor: "var(--color-accent-tint)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              src="/medianube-logo.jpeg"
              alt="medianube logo"
              width={64}
              height={64}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
              priority
            />
          </div>
          <p
            style={{
              fontSize: "16px",
              fontWeight: 500,
              color: "var(--color-text-primary)",
              margin: 0,
              letterSpacing: "0.01em",
            }}
          >
            medianube
          </p>
        </div>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 500,
              color: "var(--color-text-primary)",
              margin: "0 0 6px",
              letterSpacing: "-0.01em",
            }}
          >
            iniciar sesión
          </h1>
          <p
            style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0 }}
          >
            accedé al panel de tu panadería
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div style={{ marginBottom: "16px" }}>
            <Alert id="login-error" tone="warning" icon="error">
              {error.texto}
              {error.ofrecerRecuperar && (
                <>
                  {" "}
                  <Link href="/recuperar-password">recuperá tu contraseña</Link>.
                </>
              )}
            </Alert>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} noValidate style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Email */}
          <div>
            <label
              htmlFor="login-email"
              className="text-label-medium"
              style={{ display: "block", color: "var(--color-text-secondary)", marginBottom: "4px" }}
            >
              email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="horno@panaderia.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              disabled={isSubmitting}
              autoFocus
              className="input"
              aria-invalid={error?.campos.includes("email") || undefined}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>

          {/* Password */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4px" }}>
              <label
                htmlFor="login-password"
                className="text-label-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                contraseña
              </label>
              <Link
                id="login-forgot-password"
                href="/recuperar-password"
                className="text-label-default"
                style={{ color: "var(--color-accent-dark)", textDecoration: "none" }}
              >
                ¿olvidaste tu contraseña?
              </Link>
            </div>
            <div style={{ position: "relative" }}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                disabled={isSubmitting}
                className="input"
                style={{ paddingRight: "40px" }}
                aria-invalid={error?.campos.includes("password") || undefined}
                aria-describedby={error ? "login-error" : undefined}
              />
              <button
                type="button"
                id="login-toggle-password"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--color-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label={showPassword ? "ocultar contraseña" : "mostrar contraseña"}
              >
                <Icon name={showPassword ? "visibility_off" : "visibility"} size={16} />
              </button>
            </div>
          </div>

          {/* Primary button */}
          <div style={{ marginTop: "4px" }}>
            <Button
              id="login-submit"
              type="submit"
              variant="primary"
              block
              disabled={isSubmitting}
              iconEnd={isSubmitting ? undefined : "arrow_forward"}
              style={{ padding: "11px 16px", fontSize: "14px" }}
            >
              {isSubmitting ? "ingresando…" : "iniciar sesión"}
            </Button>
          </div>
        </form>

        {/* Footer */}
        <p
          style={{
            fontSize: "13px",
            textAlign: "center",
            color: "var(--color-text-secondary)",
            margin: "24px 0 0",
          }}
        >
          ¿no tenés cuenta?{" "}
          <Link
            id="login-register"
            href="/onboarding"
            style={{
              color: "var(--color-accent-dark)",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            registrate
          </Link>
        </p>
      </div>
    </main>
  );
}

// ── Page export (Suspense boundary for useSearchParams) ────────────────────

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
