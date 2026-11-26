"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Icon from "../../src/src/components/ui/Icon";
import Alert from "../../src/src/components/ui/Alert";
import Button from "../../src/src/components/ui/Button";
import StepProgress from "../../src/src/components/ui/StepProgress";
import Stepper from "../../src/src/components/ui/Stepper";
import { useToast } from "../../src/src/components/ui/Toast";
import PasswordInput from "../../src/src/components/ui/PasswordInput";
import PasswordRequirements, { cumpleRequisitos } from "../../src/src/components/ui/PasswordRequirements";
import { useAuth } from "../../lib/auth-context";
import { guardarNombreNegocio, guardarTipoNegocio } from "../../lib/negocio";
import dynamic from "next/dynamic";
import type { Coordinates } from "../../src/src/components/ui/LocationPicker";
import { apiUrl } from "../../lib/api";

const LocationPicker = dynamic(
  () => import("../../src/src/components/ui/LocationPicker"),
  { ssr: false }
);

// ── Types ──────────────────────────────────────────────────────────────────

type BusinessType = "panaderia" | "mixto";
interface Margenes {
  panaderia: number;
  pasteleria: number;
  bebidas: number;
}

interface FormData {
  businessName: string;
  businessType: BusinessType;
  branches: number;
  city: string;
  margenes: Margenes;
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

const TOTAL_STEPS = 4;

/** Segundos de espera entre dos envíos del código (evita el límite de intentos de Cognito). */
const ESPERA_REENVIO = 30;

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  panaderia: "panadería",
  mixto: "mixto",
};

const BUSINESS_TYPE_HELP: Record<BusinessType, string> = {
  panaderia: "venta tradicional de panificados y control de producción e insumos.",
  mixto: "combina panadería tradicional con cafetería, pastelería o rotisería.",
};

// ── Shared styles ──────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
  marginBottom: "6px",
};

const formStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "16px" };

const submitStyle: React.CSSProperties = { padding: "11px 16px" };

// ── Sub-components ────────────────────────────────────────────────────────

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

/** Título de cada paso: siempre a la izquierda, un solo eje de lectura en todo el flujo. */
function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <h1
        style={{
          fontSize: "20px",
          lineHeight: "26px",
          fontWeight: 500,
          color: "var(--color-text-primary)",
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: "13px", lineHeight: "19px", color: "var(--color-text-secondary)", margin: "4px 0 0", overflowWrap: "anywhere" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function RoundIcon({ name }: { name: string }) {
  return (
    <div
      style={{
        width: "52px",
        height: "52px",
        borderRadius: "9999px",
        backgroundColor: "var(--color-accent-tint)",
        border: "2px solid var(--color-border-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "16px",
        color: "var(--color-accent)",
      }}
    >
      <Icon name={name} size={24} />
    </div>
  );
}

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="field-error">
      <Icon name="error" size={14} />
      {children}
    </p>
  );
}

// ── Step 1: Business Data ─────────────────────────────────────────────────

function Step1({
  data,
  errors,
  location,
  authError,
  onUpdate,
  onNext,
  onLocationChange
}: {
  data: FormData;
  errors: FieldErrors;
  location: Coordinates | null;
  authError: string;
  onLocationChange: (coordinates: Coordinates) => void;
  onUpdate: (patch: Partial<FormData>) => void;
  onNext: () => void;
}) {
  return (
    <>
      <StepHeading title="contanos sobre tu panadería" />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
        style={{ ...formStyle, gap: "18px" }}
      >
        {authError && (
          <Alert tone="warning" icon="error">
            {authError}
          </Alert>
        )}

        <div>
          <label htmlFor="ob-business-name" style={labelStyle}>
            nombre del negocio
          </label>
          <input
            id="ob-business-name"
            type="text"
            autoComplete="organization"
            placeholder="ej.: panadería central"
            value={data.businessName}
            onChange={(e) => onUpdate({ businessName: e.target.value })}
            autoFocus
            className="input"
            aria-invalid={!!errors.businessName || undefined}
            aria-describedby={errors.businessName ? "ob-business-name-error" : undefined}
          />
          <FieldError id="ob-business-name-error">{errors.businessName}</FieldError>
        </div>

        <div>
          <span id="ob-type-label" style={labelStyle}>
            tipo de establecimiento
          </span>
          <div role="radiogroup" aria-labelledby="ob-type-label" style={{ display: "flex", gap: "8px" }}>
            {(["panaderia", "mixto"] as BusinessType[]).map((type) => {
              const selected = data.businessType === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  id={"ob-chip-" + type}
                  onClick={() => onUpdate({ businessType: type })}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "9999px",
                    fontSize: "12px",
                    lineHeight: "16px",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "background-color 0.15s, border-color 0.15s, color 0.15s",
                    border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-border)"}`,
                    backgroundColor: selected ? "var(--color-accent)" : "var(--color-surface)",
                    color: selected ? "var(--color-on-primary)" : "var(--color-text-primary)",
                  }}
                >
                  {BUSINESS_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
          <p className="field-help">{BUSINESS_TYPE_HELP[data.businessType]}</p>
        </div>

        <div>
          <span style={labelStyle}>sucursales</span>
          <Stepper
            id="ob-branches"
            label="sucursales"
            value={data.branches}
            min={1}
            max={10}
            onChange={(branches) => onUpdate({ branches })}
          />
        </div>

        <div>
          <label htmlFor="ob-city" style={labelStyle}>
            ciudad donde está tu negocio
          </label>

          <input
            id="ob-city"
            type="text"
            placeholder="ej.: La Plata, Buenos Aires"
            value={data.city}
            onChange={(e) => onUpdate({ city: e.target.value })}
            className="input"
            autoComplete="address-level2"
          />

          <p className="field-help">
            Ingresá la ciudad y buscala en el mapa para ubicar tu negocio.
          </p>
        </div>

        <div>
              <span style={labelStyle}>Selecciona "BUSCAR CIUDAD EN EL MAPA"</span>

              <LocationPicker
                city={data.city}
                value={location}
                onChange={onLocationChange}
              />

              {!location && (
                <p className="field-error">
                  Seleccioná la ubicación de tu negocio en el mapa.
                </p>
              )}
        </div>

        <p className="field-help" style={{ margin: 0 }}>
          usamos los índices de inflación del sector en Argentina para estimar tus costos.
        </p>

        <Button type="submit" variant="primary" block iconEnd="arrow_forward" style={submitStyle}>
          continuar
        </Button>
      </form>
    </>
  );
}

// ── Step 2: Credentials ───────────────────────────────────────────────────

function Step2({
  data,
  errors,
  onUpdate,
  onNext,
  onBack,
  loading,
  authError,
}: {
  data: FormData;
  errors: FieldErrors;
  onUpdate: (patch: Partial<FormData>) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
  authError: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <StepHeading title="creá tu cuenta" subtitle="vas a usar este email para ingresar a medianube" />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
        style={formStyle}
      >
        {authError && (
          <Alert tone="warning" icon="error">
            {authError}
          </Alert>
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
            autoFocus
            className="input"
            aria-invalid={!!errors.email || undefined}
            aria-describedby={errors.email ? "ob-email-error" : undefined}
          />
          <FieldError id="ob-email-error">{errors.email}</FieldError>
        </div>

        <div>
          <label htmlFor="ob-password" style={labelStyle}>
            contraseña
          </label>
          <PasswordInput
            id="ob-password"
            autoComplete="new-password"
            value={data.password}
            onChange={(e) => onUpdate({ password: e.target.value })}
            disabled={loading}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
            invalid={!!errors.password}
            aria-describedby={errors.password ? "ob-password-error" : undefined}
          />
          <PasswordRequirements password={data.password} />
          <FieldError id="ob-password-error">{errors.password}</FieldError>
        </div>

        <div>
          <label htmlFor="ob-confirm-password" style={labelStyle}>
            confirmar contraseña
          </label>
          <PasswordInput
            id="ob-confirm-password"
            autoComplete="new-password"
            placeholder="repetí tu contraseña"
            value={data.confirmPassword}
            onChange={(e) => onUpdate({ confirmPassword: e.target.value })}
            disabled={loading}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
            invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? "ob-confirm-password-error" : undefined}
          />
          <FieldError id="ob-confirm-password-error">{errors.confirmPassword}</FieldError>
        </div>

        <Button type="submit" variant="primary" block disabled={loading} iconEnd={loading ? undefined : "arrow_forward"} style={submitStyle}>
          {loading ? "creando tu cuenta…" : "crear cuenta"}
        </Button>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button id="ob-back" variant="text" size="sm" icon="arrow_back" onClick={onBack} disabled={loading} style={{ background: "none" }}>
            volver al paso anterior
          </Button>
        </div>
      </form>
    </>
  );
}

// ── Step 3: Confirmation Code ─────────────────────────────────────────────

function StepConfirmation({
  email,
  onConfirm,
  onResend,
  onChangeEmail,
  loading,
  authError,
  info,
  esperaReenvio,
}: {
  email: string;
  onConfirm: (code: string) => void;
  onResend: () => void;
  onChangeEmail: () => void;
  loading: boolean;
  authError: string;
  info: string;
  esperaReenvio: number;
}) {
  const [code, setCode] = useState("");

  return (
    <>
      <RoundIcon name="mark_email_read" />
      <StepHeading title="verificá tu email" subtitle={`enviamos un código de 6 dígitos a ${email}`} />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) onConfirm(code);
        }}
        style={formStyle}
      >
        {authError && (
          <Alert tone="warning" icon="error">
            {authError}
          </Alert>
        )}
        {info && <Alert tone="success">{info}</Alert>}

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
            autoFocus
            className="input"
            aria-invalid={!!authError || undefined}
            style={{ textAlign: "center", fontSize: "20px", lineHeight: "24px", fontWeight: 500, letterSpacing: "0.3em" }}
          />
        </div>

        <Button type="submit" variant="primary" block disabled={code.length < 6 || loading} iconEnd={loading ? undefined : "check"} style={submitStyle}>
          {loading ? "verificando…" : "verificar"}
        </Button>

        {/* Si el mail no llega, hay salida: reenviar o cambiar el email */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", fontSize: "12px", lineHeight: "16px", color: "var(--color-text-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "center", gap: "6px" }}>
            <span>¿no te llegó?</span>
            {esperaReenvio > 0 ? (
              <span role="timer">reenviar en {esperaReenvio} s</span>
            ) : (
              <Button id="ob-resend" variant="text" size="sm" onClick={onResend} disabled={loading} style={{ padding: 0, background: "none" }}>
                reenviar código
              </Button>
            )}
            <span aria-hidden="true">·</span>
            <Button id="ob-change-email" variant="text" size="sm" onClick={onChangeEmail} disabled={loading} style={{ padding: 0, background: "none" }}>
              cambiar email
            </Button>
          </div>
          <p style={{ margin: 0 }}>revisá también la carpeta de spam.</p>
        </div>
      </form>
    </>
  );
}

// ── Step 4: Summary ───────────────────────────────────────────────────────


function StepSummary({
  data,
  onFinish,
  loading,
  authError,
}: {
  data: FormData;
  onFinish: () => void;
  loading: boolean;
  authError: string;
}) {
  const summaryRows = [
    { label: "negocio", value: data.businessName },
    { label: "tipo", value: BUSINESS_TYPE_LABELS[data.businessType] },
    { label: "sucursales", value: String(data.branches) },
    { label: "email", value: data.email },
  ];

  return (
    <>
      <RoundIcon name="check" />
      <StepHeading
        title="¡todo listo!"
        subtitle="tu cuenta está configurada. así quedó tu panadería:"
      />

      <dl
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          margin: "0 0 20px",
        }}
      >
        {summaryRows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "16px",
              padding: "10px 14px",
              borderTop:
                i === 0
                  ? "none"
                  : "1px solid var(--color-border-divider)",
            }}
          >
            <dt
              style={{
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                fontWeight: 500,
              }}
            >
              {row.label}
            </dt>
            <dd
              style={{
                fontSize: "13px",
                color: "var(--color-text-primary)",
                margin: 0,
                textAlign: "right",
                overflowWrap: "anywhere",
              }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {authError && (
        <Alert tone="warning" icon="error">
          {authError}
        </Alert>
      )}

      <Button
        variant="primary"
        block
        disabled={loading}
        iconEnd={loading ? undefined : "arrow_forward"}
        onClick={onFinish}
        style={submitStyle}
      >
        {loading ? "ingresando…" : "ir al panel"}
      </Button>
    </>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const { signUp, confirmSignUp, resendSignUpCode, signIn, getIdToken } = useAuth();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    businessName: "",
    businessType: "panaderia",
    branches: 1,
    city: "",
    margenes: {
      panaderia: 40,
      pasteleria: 45,
      bebidas: 60,
    },
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [esperaReenvio, setEsperaReenvio] = useState(0);
  // Cuenta ya creada en Cognito durante este flujo (pendiente de verificar)
  const [registrada, setRegistrada] = useState<{ email: string; password: string } | null>(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState<Coordinates | null>(null);  useEffect(() => {
    if (esperaReenvio <= 0) return;
    const timer = setTimeout(() => setEsperaReenvio((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [esperaReenvio]);
  const [location, setLocation] = useState<Coordinates | null>(null);

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

    if (!formData.city.trim()) {
      setAuthError("ingresá la ciudad donde está tu negocio.");
      setErrors(newErrors);
      return false;
    }

    if (!location) {
      setAuthError("seleccioná la ubicación de tu negocio en el mapa.");
      setErrors(newErrors);
      return false;
    }

    setAuthError("");
    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  function validateStep2(): boolean {
    const newErrors: FieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "ingresá tu email";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "revisá el email: falta el dominio, por ejemplo @gmail.com";
    }
    if (!formData.password) {
      newErrors.password = "ingresá una contraseña";
    } else if (!cumpleRequisitos(formData.password)) {
      newErrors.password = "la contraseña todavía no cumple todos los requisitos";
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "repetí tu contraseña";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "las contraseñas no coinciden";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function irAVerificar() {
    setInfo("");
    setEsperaReenvio(ESPERA_REENVIO);
    setStep(3);
  }

  async function handleNext() {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setIsSubmitting(true);
      setAuthError("");
      try {
        // Volvió desde "cambiar email" sin cambiarlo: la cuenta ya existe, solo falta el código
        if (registrada && registrada.email === formData.email) {
          await resendSignUpCode(formData.email);
          irAVerificar();
          return;
        }

        // Note: custom attributes (businessName, businessType) are not sent
        // to Cognito because they're not defined in the User Pool schema.
        // They will be stored in the app's own database once the backend is available.
        const result = await signUp(formData.email, formData.password);
        setRegistrada({ email: formData.email, password: formData.password });
        // El nombre del negocio todavía no viaja a Cognito: queda en este navegador
        // para que el Dashboard y Configuración muestren el mismo (plan 0.14).
        guardarNombreNegocio(formData.businessName);
        guardarTipoNegocio(BUSINESS_TYPE_LABELS[formData.businessType]);
        if (result.userConfirmed) {
          setStep(4); // no hace falta verificar: directo al resumen
        } else {
          irAVerificar();
        }
      } catch (err: unknown) {
        const cognitoError = err as { code?: string };
        switch (cognitoError.code) {
          case "UsernameExistsException":
            setErrors({ email: "ya existe una cuenta con este email" });
            break;
          case "InvalidPasswordException":
            setErrors({ password: "la contraseña no cumple los requisitos de seguridad" });
            break;
          case "LimitExceededException":
            setAuthError("hiciste demasiados intentos. esperá unos minutos y volvé a probar.");
            break;
          default:
            setAuthError("no pudimos crear la cuenta. probá de nuevo en unos segundos.");
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  async function handleConfirmCode(code: string) {
    setIsSubmitting(true);
    setAuthError("");
    setInfo("");
    try {
      await confirmSignUp(formData.email, code);
      setStep(4);
    } catch (err: unknown) {
      const cognitoError = err as { code?: string };
      switch (cognitoError.code) {
        case "CodeMismatchException":
          setAuthError("el código ingresado es incorrecto.");
          break;
        case "ExpiredCodeException":
          setAuthError("el código venció. pedí uno nuevo con «reenviar código».");
          break;
        default:
          setAuthError("no pudimos verificar el código. probá de nuevo en unos segundos.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    setIsSubmitting(true);
    setAuthError("");
    setInfo("");
    try {
      await resendSignUpCode(formData.email);
      setInfo("te enviamos un código nuevo.");
      setEsperaReenvio(ESPERA_REENVIO);
    } catch (err: unknown) {
      const cognitoError = err as { code?: string };
      setAuthError(
        cognitoError.code === "LimitExceededException"
          ? "hiciste demasiados intentos. esperá unos minutos y volvé a probar."
          : "no pudimos reenviar el código. probá de nuevo en unos segundos."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleChangeEmail() {
    setAuthError("");
    setInfo("");
    setStep(2);
  }


  async function handleFinish() {
    setIsSubmitting(true);
    setAuthError("");

    try {
      // 1. Iniciar sesión en Cognito: la cuenta ya quedó verificada en el paso anterior.
      await signIn(formData.email, registrada?.password ?? formData.password);

      const token = await getIdToken();
      if (!token) throw new Error("No pudimos iniciar tu sesión. Probá de nuevo.");

      if (!location) {
        throw new Error("Falta la ubicación del negocio. Volvé al primer paso y marcala en el mapa.");
      }

      // 2. Guardar la configuración en Medianube-Configuracion (PUT /configuracion, Lambda guardarConfiguracion).
      //    La ubicación va como { lat, lon, ciudad }, el formato que lee el clima.
      const ciudad = formData.city.trim();
      const response = await fetch(apiUrl("/configuracion"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombreNegocio: formData.businessName.trim(),
          tipoLocal: formData.businessType,
          ciudad,
          sucursales: formData.branches,
          margenes: formData.margenes,
          ubicacion: { lat: location.latitud, lon: location.longitud, ciudad },
        }),
      });

      if (!response.ok) {
        throw new Error(
          response.status === 400
            ? "Revisá los datos del negocio: alguno no es válido."
            : "No pudimos guardar los datos de tu negocio. Probá de nuevo en unos minutos."
        );
      }

      // 3. Recién con la configuración guardada se pasa al panel.
      guardarNombreNegocio(formData.businessName.trim());
      guardarTipoNegocio(formData.businessType);
      toast({ message: "¡Listo! Guardamos los datos de tu negocio." });
      router.push("/dashboard");
    } catch (error) {
      // TypeError: fetch no llegó al servidor
      const mensaje =
        error instanceof TypeError
          ? "No pudimos guardar los datos de tu negocio. Revisá tu conexión y probá de nuevo."
          : error instanceof Error
            ? error.message
            : "No pudimos guardar los datos de tu negocio. Probá de nuevo.";
      toast({ tone: "error", message: mensaje });
      setAuthError(mensaje);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      id="onboarding-page"
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-bg)", paddingTop: "24px", paddingBottom: "24px" }}
    >
      <div
        id="onboarding-card"
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-2xl)",
          padding: "36px 36px 30px",
        }}
      >
        <BrandMark />
        <StepProgress step={step} total={TOTAL_STEPS} />

        {step === 1 && (
          <Step1 data={formData} errors={errors} authError={authError} onUpdate={updateData} onNext={handleNext} location={location} onLocationChange={setLocation}/>
        )}
        {step === 2 && (
          <Step2
            data={formData}
            errors={errors}
            onUpdate={updateData}
            onNext={handleNext}
            onBack={() => {
              setAuthError("");
              setStep(1);
            }}
            loading={isSubmitting}
            authError={authError}
          />
        )}
        {step === 3 && (
          <StepConfirmation
            email={formData.email}
            onConfirm={handleConfirmCode}
            onResend={handleResendCode}
            onChangeEmail={handleChangeEmail}
            loading={isSubmitting}
            authError={authError}
            info={info}
            esperaReenvio={esperaReenvio}
          />
        )}
        {step === 4 && (
          <StepSummary data={formData} onFinish={handleFinish} loading={isSubmitting} authError={authError} />
        )}

        {step < 3 && (
          <p
            style={{
              fontSize: "13px",
              textAlign: "center",
              color: "var(--color-text-secondary)",
              margin: "20px 0 0",
            }}
          >
            ¿ya tenés una cuenta?{" "}
            <Link
              id="onboarding-login-link"
              href="/login"
              style={{
                color: "var(--color-accent-dark)",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              iniciá sesión
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
