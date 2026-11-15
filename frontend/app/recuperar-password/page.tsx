"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../../src/src/components/ui/Icon";
import Alert from "../../src/src/components/ui/Alert";
import Button from "../../src/src/components/ui/Button";
import StepProgress from "../../src/src/components/ui/StepProgress";
import PasswordInput from "../../src/src/components/ui/PasswordInput";
import PasswordRequirements, { cumpleRequisitos } from "../../src/src/components/ui/PasswordRequirements";
import { useAuth } from "../../lib/auth-context";

type Step = "email" | "reset" | "done";
type Campo = "email" | "code" | "password" | "confirm";

interface ErrorForm {
  texto: string;
  /** Campo que se marca con borde de error. */
  campo?: Campo;
}

/** Segundos de espera entre dos envíos del código (evita el límite de intentos de Cognito). */
const ESPERA_REENVIO = 30;

const DEMASIADOS_INTENTOS = "hiciste demasiados intentos. esperá unos minutos y volvé a probar.";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
  marginBottom: "4px",
};

const submitStyle: React.CSSProperties = { padding: "11px 16px", fontSize: "14px" };

export default function RecuperarPasswordPage() {
  const { forgotPassword, confirmForgotPassword } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<ErrorForm | null>(null);
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [esperaReenvio, setEsperaReenvio] = useState(0);

  // Cuenta regresiva para volver a pedir el código
  useEffect(() => {
    if (esperaReenvio <= 0) return;
    const timer = setTimeout(() => setEsperaReenvio((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [esperaReenvio]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo("");

    if (!email.trim()) {
      setError({ texto: "ingresá tu email.", campo: "email" });
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setStep("reset");
      setEsperaReenvio(ESPERA_REENVIO);
    } catch (err: unknown) {
      const cognitoError = err as { code?: string };
      switch (cognitoError.code) {
        case "UserNotFoundException":
          setError({ texto: "no encontramos una cuenta con ese email.", campo: "email" });
          break;
        case "LimitExceededException":
          setError({ texto: DEMASIADOS_INTENTOS });
          break;
        case "InvalidParameterException":
          setError({ texto: "esta cuenta todavía no está confirmada. confirmá tu email primero." });
          break;
        default:
          setError({ texto: "no pudimos enviar el código. probá de nuevo en unos segundos." });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo("");
    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setInfo("te enviamos un código nuevo.");
      setEsperaReenvio(ESPERA_REENVIO);
    } catch (err: unknown) {
      const cognitoError = err as { code?: string };
      setError({
        texto:
          cognitoError.code === "LimitExceededException"
            ? DEMASIADOS_INTENTOS
            : "no pudimos reenviar el código. probá de nuevo en unos segundos.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo("");

    if (code.length < 6) {
      setError({ texto: "ingresá el código de 6 dígitos.", campo: "code" });
      return;
    }
    if (!cumpleRequisitos(password)) {
      setError({ texto: "la contraseña todavía no cumple todos los requisitos.", campo: "password" });
      return;
    }
    if (password !== confirmPassword) {
      setError({ texto: "las contraseñas no coinciden.", campo: "confirm" });
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmForgotPassword(email.trim(), code, password);
      setStep("done");
    } catch (err: unknown) {
      const cognitoError = err as { code?: string };
      switch (cognitoError.code) {
        case "CodeMismatchException":
          setError({ texto: "el código ingresado es incorrecto.", campo: "code" });
          break;
        case "ExpiredCodeException":
          setError({ texto: "el código venció. pedí uno nuevo con «reenviar código».", campo: "code" });
          break;
        case "InvalidPasswordException":
          setError({ texto: "la contraseña no cumple los requisitos de seguridad.", campo: "password" });
          break;
        case "LimitExceededException":
          setError({ texto: DEMASIADOS_INTENTOS });
          break;
        default:
          setError({ texto: "no pudimos cambiar la contraseña. probá de nuevo en unos segundos." });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const title =
    step === "email" ? "recuperar contraseña" : step === "reset" ? "creá tu nueva contraseña" : "¡contraseña actualizada!";
  const subtitle =
    step === "email"
      ? "te mandamos un código por email para que crees una nueva"
      : step === "reset"
      ? `ingresá el código que enviamos a ${email}`
      : "ya podés iniciar sesión con tu nueva contraseña";

  const describedBy = error ? "recover-error" : undefined;
  const done = step === "done";

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
        {/* Marca */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: "24px" }}>
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

        {/* Progreso: se sabe cuánto falta */}
        {!done && <StepProgress step={step === "email" ? 1 : 2} total={2} />}

        {/* Cierre: mismo círculo con check que el final del onboarding */}
        {done && (
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "9999px",
              backgroundColor: "var(--color-accent-tint)",
              border: "2px solid var(--color-border-strong)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              color: "var(--color-accent)",
            }}
          >
            <Icon name="check" size={24} />
          </div>
        )}

        {/* Título */}
        <div style={{ textAlign: done ? "center" : "left", marginBottom: "20px" }}>
          <h1 style={{ fontSize: "20px", lineHeight: "26px", fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            {title}
          </h1>
          <p style={{ fontSize: "13px", lineHeight: "19px", color: "var(--color-text-secondary)", margin: 0, overflowWrap: "anywhere" }}>{subtitle}</p>
        </div>

        {/* Error / aviso */}
        {error && (
          <div style={{ marginBottom: "16px" }}>
            <Alert id="recover-error" tone="warning" icon="error">
              {error.texto}
            </Alert>
          </div>
        )}
        {info && (
          <div style={{ marginBottom: "16px" }}>
            <Alert tone="success">{info}</Alert>
          </div>
        )}

        {/* Paso 1: email */}
        {step === "email" && (
          <form onSubmit={handleSendCode} noValidate style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label htmlFor="recover-email" style={labelStyle}>email</label>
              <input
                id="recover-email"
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
                aria-invalid={error?.campo === "email" || undefined}
                aria-describedby={describedBy}
              />
            </div>
            <Button type="submit" variant="primary" block disabled={isSubmitting} style={submitStyle}>
              {isSubmitting ? "enviando…" : "enviar código"}
            </Button>
          </form>
        )}

        {/* Paso 2: código + nueva contraseña */}
        {step === "reset" && (
          <form onSubmit={handleReset} noValidate style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                disabled={isSubmitting}
                autoFocus
                className="input"
                aria-invalid={error?.campo === "code" || undefined}
                aria-describedby={describedBy}
                style={{ textAlign: "center", fontSize: "20px", lineHeight: "24px", fontWeight: 500, letterSpacing: "0.3em" }}
              />
            </div>

            <div>
              <label htmlFor="recover-password" style={labelStyle}>nueva contraseña</label>
              <PasswordInput
                id="recover-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                disabled={isSubmitting}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((v) => !v)}
                invalid={error?.campo === "password"}
                aria-describedby={describedBy}
              />
              <PasswordRequirements password={password} />
            </div>

            <div>
              <label htmlFor="recover-confirm-password" style={labelStyle}>confirmar contraseña</label>
              <PasswordInput
                id="recover-confirm-password"
                autoComplete="new-password"
                placeholder="repetí tu contraseña"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                disabled={isSubmitting}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((v) => !v)}
                invalid={error?.campo === "confirm"}
                aria-describedby={describedBy}
              />
            </div>

            <Button type="submit" variant="primary" block disabled={isSubmitting} style={submitStyle}>
              {isSubmitting ? "guardando…" : "restablecer contraseña"}
            </Button>

            {/* Reenviar: visible, con cuenta regresiva */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "12px", lineHeight: "16px", color: "var(--color-text-secondary)" }}>
              <span>¿no te llegó?</span>
              {esperaReenvio > 0 ? (
                <span id="recover-resend-wait" role="timer">reenviar código en {esperaReenvio} s</span>
              ) : (
                <Button id="recover-resend" variant="text" size="sm" onClick={handleResend} disabled={isSubmitting} style={{ padding: 0, background: "none" }}>
                  reenviar código
                </Button>
              )}
            </div>
          </form>
        )}

        {/* Paso 3: listo */}
        {done && (
          <Button id="recover-go-login" variant="primary" block href="/login" iconEnd="arrow_forward">
            ir a iniciar sesión
          </Button>
        )}

        {/* Pie */}
        {!done && (
          <p style={{ fontSize: "13px", textAlign: "center", margin: "20px 0 0" }}>
            <Link
              id="recover-back-login"
              href="/login"
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--color-accent-dark)", fontWeight: 500, textDecoration: "none" }}
            >
              <Icon name="arrow_back" size={14} />
              volver a iniciar sesión
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
