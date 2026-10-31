"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Icon from "../../src/src/components/ui/Icon";
import { useAuth } from "../../lib/auth-context";

type Step = "email" | "reset" | "done";

const inputStyle: React.CSSProperties = {
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
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
  marginBottom: "4px",
};

function PrimaryButton({ label, loadingLabel, loading }: { label: string; loadingLabel: string; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: "100%",
        backgroundColor: "var(--color-accent)",
        color: "var(--color-on-primary)",
        border: "none",
        borderRadius: "var(--radius-md)",
        padding: "12px",
        fontSize: "14px",
        fontWeight: 500,
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? (
        <>
          {loadingLabel}
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
        label
      )}
    </button>
  );
}

export default function RecuperarPasswordPage() {
  const { forgotPassword, confirmForgotPassword } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email.trim()) {
      setError("ingresá tu email");
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setStep("reset");
    } catch (err: unknown) {
      const cognitoError = err as { code?: string; message?: string };
      switch (cognitoError.code) {
        case "UserNotFoundException":
          setError("no encontramos una cuenta con ese email.");
          break;
        case "LimitExceededException":
          setError("hiciste demasiados intentos. esperá unos minutos y volvé a probar.");
          break;
        case "InvalidParameterException":
          setError("esta cuenta todavía no está confirmada. confirmá tu email primero.");
          break;
        default:
          setError(cognitoError.message || "ocurrió un error inesperado.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError("");
    setInfo("");
    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setInfo("te enviamos un código nuevo.");
    } catch (err: unknown) {
      const cognitoError = err as { code?: string; message?: string };
      setError(
        cognitoError.code === "LimitExceededException"
          ? "hiciste demasiados intentos. esperá unos minutos y volvé a probar."
          : cognitoError.message || "no pudimos reenviar el código."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (code.length < 6) {
      setError("ingresá el código de 6 dígitos");
      return;
    }
    if (password.length < 8) {
      setError("la contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("las contraseñas no coinciden");
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmForgotPassword(email.trim(), code, password);
      setStep("done");
    } catch (err: unknown) {
      const cognitoError = err as { code?: string; message?: string };
      switch (cognitoError.code) {
        case "CodeMismatchException":
          setError("el código ingresado es incorrecto.");
          break;
        case "ExpiredCodeException":
          setError("el código expiró. pedí uno nuevo.");
          break;
        case "InvalidPasswordException":
          setError("la contraseña no cumple los requisitos de seguridad (mayúscula, minúscula, número y símbolo).");
          break;
        case "LimitExceededException":
          setError("hiciste demasiados intentos. esperá unos minutos y volvé a probar.");
          break;
        default:
          setError(cognitoError.message || "ocurrió un error inesperado.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const title =
    step === "email" ? "recuperar contraseña" : step === "reset" ? "creá tu nueva contraseña" : "¡contraseña actualizada!";
  const subtitle =
    step === "email"
      ? "te enviamos un código por email para restablecerla"
      : step === "reset"
      ? `ingresá el código que enviamos a ${email}`
      : "ya podés iniciar sesión con tu nueva contraseña";

  return (
    <main
      id="recover-page"
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div
        id="recover-card"
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "9999px",
              border: "2px solid var(--color-border-strong)",
              backgroundColor: "var(--color-accent-tint)",
              overflow: "hidden",
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
          <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0, letterSpacing: "0.01em" }}>
            medianube
          </p>
        </div>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
            {title}
          </h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0 }}>{subtitle}</p>
        </div>

        {/* Error / info */}
        {error && (
          <div
            id="recover-error"
            role="alert"
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
            <span style={{ fontSize: "13px", color: "var(--color-warning-text)" }}>{error}</span>
          </div>
        )}
        {info && (
          <div
            role="status"
            style={{
              backgroundColor: "var(--color-success-bg)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "var(--color-success-text)",
            }}
          >
            {info}
          </div>
        )}

        {/* Paso 1: email */}
        {step === "email" && (
          <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label htmlFor="recover-email" style={labelStyle}>email</label>
              <input
                id="recover-email"
                type="email"
                autoComplete="email"
                placeholder="horno@panaderia.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                style={{ ...inputStyle, opacity: isSubmitting ? 0.6 : 1 }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              />
            </div>
            <PrimaryButton label="enviar código" loadingLabel="enviando…" loading={isSubmitting} />
          </form>
        )}

        {/* Paso 2: código + nueva contraseña */}
        {step === "reset" && (
          <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label htmlFor="recover-code" style={labelStyle}>código de verificación</label>
              <input
                id="recover-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={isSubmitting}
                style={{
                  ...inputStyle,
                  textAlign: "center",
                  fontSize: "20px",
                  fontWeight: 500,
                  letterSpacing: "0.3em",
                  opacity: isSubmitting ? 0.6 : 1,
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              />
            </div>

            <div>
              <label htmlFor="recover-password" style={labelStyle}>nueva contraseña</label>
              <div style={{ position: "relative" }}>
                <input
                  id="recover-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  style={{ ...inputStyle, paddingRight: "40px", opacity: isSubmitting ? 0.6 : 1 }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
                <button
                  type="button"
                  id="recover-toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "ocultar contraseña" : "mostrar contraseña"}
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
                >
                  <Icon name={showPassword ? "visibility_off" : "visibility"} size={16} />
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="recover-confirm-password" style={labelStyle}>confirmar contraseña</label>
              <input
                id="recover-confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="repetí tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                style={{ ...inputStyle, opacity: isSubmitting ? 0.6 : 1 }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              />
            </div>

            <PrimaryButton label="restablecer contraseña" loadingLabel="guardando…" loading={isSubmitting} />

            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                id="recover-resend"
                onClick={handleResend}
                disabled={isSubmitting}
                className="text-caption"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  color: "var(--color-text-muted)",
                  textDecoration: "underline",
                }}
              >
                reenviar código
              </button>
            </div>
          </form>
        )}

        {/* Paso 3: listo */}
        {step === "done" && (
          <Link
            id="recover-go-login"
            href="/login"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              width: "100%",
              boxSizing: "border-box",
              backgroundColor: "var(--color-accent)",
              color: "var(--color-on-primary)",
              borderRadius: "var(--radius-md)",
              padding: "12px",
              fontSize: "14px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            ir a iniciar sesión
            <Icon name="arrow_forward" size={14} />
          </Link>
        )}

        {/* Footer */}
        {step !== "done" && (
          <p style={{ fontSize: "13px", textAlign: "center", color: "var(--color-text-secondary)", margin: "24px 0 0" }}>
            <Link
              id="recover-back-login"
              href="/login"
              style={{ color: "var(--color-accent)", fontWeight: 500, textDecoration: "none" }}
            >
              ← volver a iniciar sesión
            </Link>
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}