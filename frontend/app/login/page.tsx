"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "../../src/src/components/ui/Icon";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    router.push("/dashboard");
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
              <button
                type="button"
                id="login-forgot-password"
                className="text-caption"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--color-text-muted)",
                  textDecoration: "underline",
                }}
              >
                ¿olvidaste tu contraseña?
              </button>
            </div>
          </div>

          {/* Primary button */}
          <button
            id="login-submit"
            type="submit"
            style={{
              width: "100%",
              backgroundColor: "var(--color-accent)",
              color: "var(--color-on-primary)",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "12px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              marginTop: "4px",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--color-accent-dark)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--color-accent)")
            }
          >
            iniciar sesión
            <Icon name="arrow_forward" size={14} />
          </button>
        </form>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            margin: "20px 0",
          }}
        >
          <div
            style={{
              flex: 1,
              height: "1px",
              backgroundColor: "var(--color-border-divider)",
            }}
          />
          <span
            className="text-caption"
            style={{ color: "var(--color-text-muted)" }}
          >
            o
          </span>
          <div
            style={{
              flex: 1,
              height: "1px",
              backgroundColor: "var(--color-border-divider)",
            }}
          />
        </div>

        {/* Google button */}
        <button
          id="login-google"
          type="button"
          style={{
            width: "100%",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "11px",
            fontSize: "14px",
            color: "var(--color-text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "border-color 0.15s, background-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-neutral-bg)";
            e.currentTarget.style.borderColor = "var(--color-border-strong)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-surface)";
            e.currentTarget.style.borderColor = "var(--color-border)";
          }}
        >
          {/* Google SVG icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          ingresar con Google
        </button>

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
    </main>
  );
}
