"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Icon from "../../src/src/components/ui/Icon";
import { useAuth } from "../../lib/auth-context";

// ── Inner component (needs useSearchParams inside Suspense) ────────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("completá todos los campos");
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(email, password);
      const redirect = searchParams.get("redirect") || "/dashboard";
      router.push(redirect);
    } catch (err: unknown) {
      const cognitoError = err as { code?: string; message?: string };
      switch (cognitoError.code) {
        case "UserNotConfirmedException":
          setError("tu cuenta aún no fue confirmada. revisá tu email.");
          break;
        case "NotAuthorizedException":
          setError("email o contraseña incorrectos.");
          break;
        case "UserNotFoundException":
          setError("no encontramos una cuenta con ese email.");
          break;
        default:
          setError(cognitoError.message || "ocurrió un error inesperado.");
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
          <div style={{ textAlign: "center", lineHeight: "1" }}>
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
            <p
              className="text-caption"
              style={{
                color: "var(--color-text-muted)",
                letterSpacing: "0.14em",
                margin: "3px 0 0",
              }}
            >
              SOFTWARE
            </p>
          </div>
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
          <div
            id="login-error"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Icon name="error" size={16} />
            <span style={{ fontSize: "13px", color: "var(--color-warning-text)" }}>
              {error}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: "100%",
                boxSizing: "border-box",
                backgroundColor: "var(--color-surface-input)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "11px 14px",
                fontSize: "13px",
                color: "var(--color-text-primary)",
                outline: "none",
                transition: "border-color 0.15s",
                opacity: isSubmitting ? 0.6 : 1,
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="login-password"
              className="text-label-medium"
              style={{ display: "block", color: "var(--color-text-secondary)", marginBottom: "4px" }}
            >
              contraseña
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  backgroundColor: "var(--color-surface-input)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "11px 40px 11px 14px",
                  fontSize: "13px",
                  color: "var(--color-text-primary)",
                  outline: "none",
                  transition: "border-color 0.15s",
                  opacity: isSubmitting ? 0.6 : 1,
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
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
                  color: "var(--color-text-muted)",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label={showPassword ? "ocultar contraseña" : "mostrar contraseña"}
              >
                <Icon name={showPassword ? "visibility_off" : "visibility"} size={16} />
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <Link
                id="login-forgot-password"
                href="/recuperar-password"
                className="text-caption"
                style={{
                  color: "var(--color-text-muted)",
                  textDecoration: "underline",
                }}
              >
                ¿olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          {/* Primary button */}
          <button
            id="login-submit"
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              backgroundColor: "var(--color-accent)",
              color: "var(--color-on-primary)",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "12px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              marginTop: "4px",
              transition: "background-color 0.15s",
              opacity: isSubmitting ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = "var(--color-accent-dark)";
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = "var(--color-accent)";
            }}
          >
            {isSubmitting ? (
              <>
                ingresando…
                <span
                  style={{
                    display: "inline-block",
                    width: "14px",
                    height: "14px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }}
                />
              </>
            ) : (
              <>
                iniciar sesión
                <Icon name="arrow_forward" size={14} />
              </>
            )}
          </button>
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
              color: "var(--color-accent)",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            registrate
          </Link>
        </p>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
