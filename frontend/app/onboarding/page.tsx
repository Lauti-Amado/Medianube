"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Icon from "../../src/src/components/ui/Icon";
import { useAuth } from "../../lib/auth-context";

// ── Types ──────────────────────────────────────────────────────────────────

type BusinessType = "panaderia" | "mixto";

interface FormData {
  businessName: string;
  businessType: BusinessType;
  branches: number;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FieldErrors {
  businessName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  panaderia: "panadería",
  mixto: "mixto",
};

// ── Shared styles ──────────────────────────────────────────────────────────

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
  marginBottom: "7px",
};

const errorStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-warning-text)",
  marginTop: "4px",
};

// ── Sub-components ────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  // 4 steps now: business data, credentials, confirmation code, summary
  const totalSteps = 4;
  return (
    <div style={{ width: "100%", display: "grid", gridTemplateColumns: `repeat(${totalSteps}, 1fr)`, gap: "6px", marginBottom: "20px" }}>
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
        <div
          key={s}
          style={{
            height: "4px",
            borderRadius: "9999px",
            backgroundColor: s <= step ? "var(--color-accent)" : "var(--color-border-divider)",
            transition: "background-color 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

function BrandMark() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" }}>
      <div
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "9999px",
          border: "2px solid var(--color-border-strong)",
          backgroundColor: "var(--color-accent-tint)",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "8px",
        }}
      >
        <Image
          src="/medianube-logo.jpeg"
          alt="medianube logo"
          width={52}
          height={52}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
          priority
        />
      </div>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--color-text-primary)",
          letterSpacing: "0.01em",
        }}
      >
        medianube
      </span>
    </div>
  );
}

function StepHeading({ title, subtitle }: { step?: number; title: string; subtitle?: string }) {
  return (
    <div style={{ width: "100%", marginBottom: "20px" }}>
      <h1
        style={{
          fontSize: "18px",
          fontWeight: 500,
          color: "var(--color-text-primary)",
          margin: subtitle ? "0 0 6px" : 0,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0, lineHeight: "1.5" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function PrimaryButton({
  label,
  icon,
  onClick,
  disabled,
  loading,
}: {
  label: string;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: "100%",
        backgroundColor: "var(--color-accent)",
        color: "var(--color-on-primary)",
        border: "none",
        borderRadius: "var(--radius-md)",
        padding: "11px 14px",
        fontSize: "13px",
        fontWeight: 500,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        transition: "background-color 0.15s",
        opacity: disabled || loading ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) e.currentTarget.style.backgroundColor = "var(--color-accent-dark)";
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) e.currentTarget.style.backgroundColor = "var(--color-accent)";
      }}
    >
      {loading ? (
        <>
          procesando…
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
          {label}
          <Icon name={icon} size={16} />
        </>
      )}
    </button>
  );
}

// ── Step 1: Business Data ─────────────────────────────────────────────────

function Step1({
  data,
  errors,
  onUpdate,
  onNext,
}: {
  data: FormData;
  errors: FieldErrors;
  onUpdate: (patch: Partial<FormData>) => void;
  onNext: () => void;
}) {
  return (
    <>
      <StepHeading
        step={1}
        title="contanos sobre tu panadería"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%" }}>
        <div>
          <label htmlFor="ob-business-name" style={labelStyle}>
            nombre del negocio
          </label>
          <input
            id="ob-business-name"
            type="text"
            placeholder="panadería medianube"
            value={data.businessName}
            onChange={(e) => onUpdate({ businessName: e.target.value })}
            style={{
              ...inputStyle,
              borderColor: errors.businessName ? "var(--color-warning-text)" : "var(--color-border)",
            }}
            onFocus={(e) => { if (!errors.businessName) e.target.style.borderColor = "var(--color-accent)"; }}
            onBlur={(e) => { if (!errors.businessName) e.target.style.borderColor = "var(--color-border)"; }}
          />
          {errors.businessName && <p style={errorStyle}>{errors.businessName}</p>}
        </div>

        <div>
          <label style={labelStyle}>tipo de establecimiento</label>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["panaderia", "mixto"] as BusinessType[]).map((type) => (
              <button
                key={type}
                type="button"
                id={"ob-chip-" + type}
                onClick={() => onUpdate({ businessType: type })}
                style={{
                  padding: "6px 16px",
                  borderRadius: "9999px",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border: data.businessType === type ? "none" : "1px solid var(--color-border)",
                  backgroundColor: data.businessType === type ? "var(--color-accent)" : "var(--color-surface)",
                  color: data.businessType === type ? "var(--color-on-primary)" : "var(--color-text-primary)",
                }}
              >
                {BUSINESS_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          <p
            style={{
              fontSize: "12px",
              color: "var(--color-text-secondary)",
              marginTop: "9px",
              lineHeight: "1.5",
            }}
          >
            {data.businessType === "panaderia"
              ? "Venta tradicional de panificados y control de producción/insumos."
              : "Combina panadería tradicional con cafetería, pastelería o rotisería."}
          </p>
        </div>

        <div>
          <label htmlFor="ob-branches" style={labelStyle}>
            sucursales
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="ob-branches"
              type="number"
              min={1}
              value={data.branches}
              onChange={(e) => onUpdate({ branches: Math.max(1, parseInt(e.target.value) || 1) })}
              style={{ ...inputStyle, paddingRight: "36px" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <span
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "var(--color-text-muted)",
                fontSize: "18px",
                fontFamily: "Material Symbols Outlined",
                fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
              }}
            >
              storefront
            </span>
          </div>
        </div>

        <div
          style={{
            width: "100%",
            backgroundColor: "var(--color-accent-tint)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "10px 12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <span style={{ color: "var(--color-accent-dark)", flexShrink: 0, marginTop: "1px", display: "flex" }}>
            <Icon name="auto_awesome" size={16} />
          </span>
          <p style={{ fontSize: "11px", color: "var(--color-text-callout)", margin: 0, lineHeight: "1.5" }}>
            ajustaremos los algoritmos de costos e inflación según los índices del sector en Argentina.
          </p>
        </div>

        <div style={{ paddingTop: "4px" }}>
          <PrimaryButton label="continuar" icon="arrow_forward" onClick={onNext} />
        </div>
      </div>
    </>
  );
}

// ── Step 2: Credentials ───────────────────────────────────────────────────

function Step2({
  data,
  errors,
  onUpdate,
  onNext,
  loading,
  authError,
}: {
  data: FormData;
  errors: FieldErrors;
  onUpdate: (patch: Partial<FormData>) => void;
  onNext: () => void;
  loading: boolean;
  authError: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <StepHeading
        step={2}
        title="creá tu cuenta"
        subtitle="vas a usar este email para ingresar a medianube"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%" }}>
        {/* Auth error from Cognito */}
        {authError && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Icon name="error" size={16} />
            <span style={{ fontSize: "13px", color: "var(--color-warning-text)" }}>
              {authError}
            </span>
          </div>
        )}

        <div>
          <label htmlFor="ob-email" style={labelStyle}>
            email
          </label>
          <input
            id="ob-email"
            type="email"
            autoComplete="email"
            placeholder="horno@panaderia.com"
            value={data.email}
            onChange={(e) => onUpdate({ email: e.target.value })}
            disabled={loading}
            style={{
              ...inputStyle,
              borderColor: errors.email ? "var(--color-warning-text)" : "var(--color-border)",
              opacity: loading ? 0.6 : 1,
            }}
            onFocus={(e) => { if (!errors.email) e.target.style.borderColor = "var(--color-accent)"; }}
            onBlur={(e) => { if (!errors.email) e.target.style.borderColor = "var(--color-border)"; }}
          />
          {errors.email && <p style={errorStyle}>{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="ob-password" style={labelStyle}>
            contraseña
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="ob-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="mínimo 8 caracteres"
              value={data.password}
              onChange={(e) => onUpdate({ password: e.target.value })}
              disabled={loading}
              style={{
                ...inputStyle,
                paddingRight: "40px",
                borderColor: errors.password ? "var(--color-warning-text)" : "var(--color-border)",
                opacity: loading ? 0.6 : 1,
              }}
              onFocus={(e) => { if (!errors.password) e.target.style.borderColor = "var(--color-accent)"; }}
              onBlur={(e) => { if (!errors.password) e.target.style.borderColor = "var(--color-border)"; }}
            />
            <button
              type="button"
              id="ob-toggle-password"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--color-text-muted)", display: "flex", alignItems: "center" }}
              aria-label={showPassword ? "ocultar contraseña" : "mostrar contraseña"}
            >
              <Icon name={showPassword ? "visibility_off" : "visibility"} size={16} />
            </button>
          </div>
          {errors.password && <p style={errorStyle}>{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="ob-confirm-password" style={labelStyle}>
            confirmar contraseña
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="ob-confirm-password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="repetí tu contraseña"
              value={data.confirmPassword}
              onChange={(e) => onUpdate({ confirmPassword: e.target.value })}
              disabled={loading}
              style={{
                ...inputStyle,
                paddingRight: "40px",
                borderColor: errors.confirmPassword ? "var(--color-warning-text)" : "var(--color-border)",
                opacity: loading ? 0.6 : 1,
              }}
              onFocus={(e) => { if (!errors.confirmPassword) e.target.style.borderColor = "var(--color-accent)"; }}
              onBlur={(e) => { if (!errors.confirmPassword) e.target.style.borderColor = "var(--color-border)"; }}
            />
            <button
              type="button"
              id="ob-toggle-confirm-password"
              onClick={() => setShowConfirm((v) => !v)}
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--color-text-muted)", display: "flex", alignItems: "center" }}
              aria-label={showConfirm ? "ocultar contraseña" : "mostrar contraseña"}
            >
              <Icon name={showConfirm ? "visibility_off" : "visibility"} size={16} />
            </button>
          </div>
          {errors.confirmPassword && <p style={errorStyle}>{errors.confirmPassword}</p>}
        </div>

        <div style={{ paddingTop: "4px" }}>
          <PrimaryButton label="crear cuenta" icon="arrow_forward" onClick={onNext} loading={loading} />
        </div>
      </div>
    </>
  );
}

// ── Step 3: Confirmation Code ─────────────────────────────────────────────

function StepConfirmation({
  email,
  onConfirm,
  loading,
  authError,
}: {
  email: string;
  onConfirm: (code: string) => void;
  loading: boolean;
  authError: string;
}) {
  const [code, setCode] = useState("");

  return (
    <>
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
          marginBottom: "16px",
          alignSelf: "center",
        }}
      >
        <span style={{ color: "var(--color-accent)", display: "flex" }}>
          <Icon name="mark_email_read" size={24} />
        </span>
      </div>

      <StepHeading
        title="verificá tu email"
        subtitle={`enviamos un código de 6 dígitos a ${email}`}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%" }}>
        {authError && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Icon name="error" size={16} />
            <span style={{ fontSize: "13px", color: "var(--color-warning-text)" }}>
              {authError}
            </span>
          </div>
        )}

        <div>
          <label htmlFor="ob-confirmation-code" style={labelStyle}>
            código de verificación
          </label>
          <input
            id="ob-confirmation-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={loading}
            style={{
              ...inputStyle,
              textAlign: "center",
              fontSize: "20px",
              fontWeight: 600,
              letterSpacing: "0.3em",
              opacity: loading ? 0.6 : 1,
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
          />
        </div>

        <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: 0, textAlign: "center" }}>
          ¿no recibiste el código? revisá tu carpeta de spam
        </p>

        <div style={{ paddingTop: "4px" }}>
          <PrimaryButton
            label="verificar"
            icon="check"
            onClick={() => onConfirm(code)}
            disabled={code.length < 6}
            loading={loading}
          />
        </div>
      </div>
    </>
  );
}

// ── Step 4: Summary ───────────────────────────────────────────────────────

function StepSummary({ data, onFinish, loading }: { data: FormData; onFinish: () => void; loading: boolean }) {
  const summaryRows = [
    { label: "negocio", value: data.businessName },
    { label: "tipo", value: BUSINESS_TYPE_LABELS[data.businessType] },
    { label: "sucursales", value: String(data.branches) },
    { label: "email", value: data.email },
  ];

  return (
    <>
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
          marginBottom: "16px",
          alignSelf: "center",
        }}
      >
        <span style={{ color: "var(--color-accent)", display: "flex" }}>
          <Icon name="check" size={24} />
        </span>
      </div>

      <div style={{ textAlign: "center", marginBottom: "20px", width: "100%" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
          ¡todo listo!
        </h1>
        <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0 }}>
          tu cuenta está configurada. así quedó tu panadería:
        </p>
      </div>

      <div
        style={{
          width: "100%",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          marginBottom: "20px",
        }}
      >
        {summaryRows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderTop: i === 0 ? "none" : "1px solid var(--color-border-divider)",
            }}
          >
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
              {row.label}
            </span>
            <span style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div style={{ width: "100%" }}>
        <PrimaryButton label="ir al panel" icon="arrow_forward" onClick={onFinish} loading={loading} />
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { signUp, confirmSignUp, signIn } = useAuth();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    businessName: "",
    businessType: "panaderia",
    branches: 1,
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateData(patch: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
    const clearedErrors: FieldErrors = { ...errors };
    (Object.keys(patch) as (keyof FieldErrors)[]).forEach((key) => {
      delete clearedErrors[key];
    });
    setErrors(clearedErrors);
    setAuthError("");
  }

  function validateStep1(): boolean {
    const newErrors: FieldErrors = {};
    if (!formData.businessName.trim()) {
      newErrors.businessName = "ingresá el nombre del negocio";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateStep2(): boolean {
    const newErrors: FieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "ingresá tu email";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "el formato del email no es válido";
    }
    if (!formData.password) {
      newErrors.password = "ingresá una contraseña";
    } else if (formData.password.length < 8) {
      newErrors.password = "la contraseña debe tener al menos 8 caracteres";
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "confirmá tu contraseña";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "las contraseñas no coinciden";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleNext() {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      // Register with Cognito
      setIsSubmitting(true);
      setAuthError("");
      try {
        // Note: custom attributes (businessName, businessType) are not sent
        // to Cognito because they're not defined in the User Pool schema.
        // They will be stored in the app's own database once the backend is available.
        const result = await signUp(formData.email, formData.password);
        if (result.userConfirmed) {
          // No confirmation needed — skip to summary
          setStep(4);
        } else {
          // Needs email confirmation
          setStep(3);
        }
      } catch (err: unknown) {
        const cognitoError = err as { code?: string; message?: string };
        switch (cognitoError.code) {
          case "UsernameExistsException":
            setAuthError("ya existe una cuenta con este email.");
            break;
          case "InvalidPasswordException":
            setAuthError("la contraseña no cumple los requisitos de seguridad (mayúscula, minúscula, número y símbolo).");
            break;
          default:
            setAuthError(cognitoError.message || "ocurrió un error al crear la cuenta.");
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  async function handleConfirmCode(code: string) {
    setIsSubmitting(true);
    setAuthError("");
    try {
      await confirmSignUp(formData.email, code);
      setStep(4);
    } catch (err: unknown) {
      const cognitoError = err as { code?: string; message?: string };
      switch (cognitoError.code) {
        case "CodeMismatchException":
          setAuthError("el código ingresado es incorrecto.");
          break;
        case "ExpiredCodeException":
          setAuthError("el código expiró. solicitá uno nuevo.");
          break;
        default:
          setAuthError(cognitoError.message || "ocurrió un error al verificar el código.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFinish() {
    setIsSubmitting(true);
    try {
      // Auto-login after registration
      await signIn(formData.email, formData.password);
      router.push("/dashboard");
    } catch {
      // If auto-login fails, redirect to login page
      router.push("/login");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      id="onboarding-page"
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div
        id="onboarding-card"
        style={{
          width: "100%",
          maxWidth: "410px",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-2xl)",
          padding: "36px 32px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <BrandMark />
        <ProgressBar step={step} />

        {step === 1 && (
          <Step1 data={formData} errors={errors} onUpdate={updateData} onNext={handleNext} />
        )}
        {step === 2 && (
          <Step2
            data={formData}
            errors={errors}
            onUpdate={updateData}
            onNext={handleNext}
            loading={isSubmitting}
            authError={authError}
          />
        )}
        {step === 3 && (
          <StepConfirmation
            email={formData.email}
            onConfirm={handleConfirmCode}
            loading={isSubmitting}
            authError={authError}
          />
        )}
        {step === 4 && (
          <StepSummary data={formData} onFinish={handleFinish} loading={isSubmitting} />
        )}

        {step < 3 && (
          <p
            style={{
              fontSize: "13px",
              textAlign: "center",
              color: "var(--color-text-secondary)",
              margin: "24px 0 0",
            }}
          >
            ¿ya tenés una cuenta?{" "}
            <Link
              id="onboarding-login-link"
              href="/login"
              style={{
                color: "var(--color-accent)",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              iniciá sesión
            </Link>
          </p>
        )}
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
