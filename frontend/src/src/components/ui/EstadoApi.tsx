"use client";

import type { ReactNode } from "react";
import Alert from "./Alert";
import Button from "./Button";
import { SkeletonRows } from "./Skeleton";

export type OrigenMotor = "ia" | "reglas" | null;

function clasificarOrigen(origen?: string | null): OrigenMotor {
  if (!origen) return "ia";
  const n = origen.trim().toLowerCase();
  if (n === "reglas") return "reglas";
  return "ia";
}

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

/**
 * Envuelve un bloque que depende de la API: muestra skeleton mientras carga,
 * un aviso con "reintentar" si falla, y de dónde salen los datos (IA o cálculo automático).
 */
export default function EstadoApi({
  loading,
  loadingLabel = "Cargando…",
  error,
  errorTitle = "No pudimos cargar los datos",
  onRetry,
  origen,
  mensajeReglas,
  mensajeIa,
  children,
}: EstadoApiProps) {
  const tipo = clasificarOrigen(origen);

  if (loading) {
    return (
      <div className="card">
        <SkeletonRows rows={3} label={loadingLabel} />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        tone="warning"
        icon="error"
        action={
          onRetry && (
            <Button variant="warning" size="sm" icon="refresh" onClick={onRetry}>
              reintentar
            </Button>
          )
        }
      >
        <strong>{errorTitle}.</strong> {error}
      </Alert>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {tipo === "reglas" && (
        <Alert tone="warning" icon="info">
          {mensajeReglas ?? (
            <>
              <strong>Calculado sin IA.</strong> La IA no respondió, así que estos números salen
              de un cálculo automático más simple.
            </>
          )}
        </Alert>
      )}
      {tipo === "ia" && (
        <Alert tone="ia">
          {mensajeIa ?? (
            <>
              <strong>Calculado con IA</strong> a partir de los datos de tu negocio.
            </>
          )}
        </Alert>
      )}
      {children}
    </div>
  );
}
