"use client";

import type { ReactNode } from "react";

export type OrigenMotor = "ia" | "reglas" | null;

function clasificarOrigen(origen?: string | null): OrigenMotor {
  if (!origen) return "ia";
  const n = origen.trim().toLowerCase();
  if (n === "reglas") return "reglas";
  return "ia";
}

const icon: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
  fontSize: "18px",
  lineHeight: 1,
  userSelect: "none",
};

interface EstadoApiProps {
  loading: boolean;
  loadingLabel?: string;
  error?: string | null;
  errorTitle?: string;
  onRetry?: () => void;
  origen?: string | null;
  mensajeReglas?: ReactNode;
  mensajeIa?: ReactNode;
  children?: ReactNode;
}

export default function EstadoApi({
  loading,
  loadingLabel = "Consultando el motor de IA…",
  error,
  errorTitle = "No se pudo contactar a la API",
  onRetry,
  origen,
  mensajeReglas,
  mensajeIa,
  children,
}: EstadoApiProps) {
  const tipo = clasificarOrigen(origen);

  if (loading) {
    return (
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: "40px 16px",
          textAlign: "center",
        }}
      >
        <style>{`@keyframes estado-api-spin { to { transform: rotate(360deg); } }`}</style>
        <span
          style={{
            ...icon,
            fontSize: 28,
            color: "var(--color-accent)",
            display: "inline-block",
            animation: "estado-api-spin 1s linear infinite",
          }}
        >
          autorenew
        </span>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--color-text-primary)",
            margin: "12px 0 0",
          }}
        >
          {loadingLabel}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0" }}>
          Esperá un momento, no recargues la página.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          backgroundColor: "var(--color-warning-bg)",
          border: "1px solid var(--color-warning-text)",
          borderRadius: 10,
          padding: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ ...icon, fontSize: 22, color: "var(--color-warning-text)" }}>error</span>
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-warning-text)",
                margin: "0 0 4px",
              }}
            >
              {errorTitle}
            </p>
            <p style={{ fontSize: 12, color: "var(--color-warning-text)", margin: 0 }}>{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  backgroundColor: "var(--color-warning-text)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <span style={{ ...icon, fontSize: 15 }}>refresh</span>
                Reintentar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {tipo === "reglas" && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "10px 14px",
            backgroundColor: "var(--color-warning-bg)",
            borderLeft: "4px solid var(--color-warning-text)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--color-warning-text)",
          }}
        >
          <span style={{ ...icon, color: "var(--color-warning-text)" }}>info</span>
          <div>
            {mensajeReglas ?? (
              <>
                <strong>Sin datos de IA.</strong> La Lambda devolvió origen &quot;reglas&quot;: el motor
                no respondió o cayó al cálculo automático. Los números no vienen de un modelo de
                lenguaje.
              </>
            )}
          </div>
        </div>
      )}
      {tipo === "ia" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            backgroundColor: "var(--color-success-bg)",
            borderLeft: "4px solid var(--color-success-text)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--color-success-text)",
          }}
        >
          <span style={icon}>check_circle</span>
          <span>
            {mensajeIa ?? (
              <>
                <strong>Datos con IA.</strong> La sugerencia la generó el modelo a partir del
                contexto enviado a la Lambda.
              </>
            )}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
