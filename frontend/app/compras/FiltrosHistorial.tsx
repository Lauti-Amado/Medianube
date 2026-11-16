"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "../../src/src/components/ui/Icon";

export interface FiltrosGastos {
  proveedor: string;
  desde: string;
  hasta: string;
}

export const FILTROS_VACIOS: FiltrosGastos = { proveedor: "", desde: "", hasta: "" };

interface Props {
  /** Filtros vigentes. El componente es controlado: "limpiar filtros" los resetea desde afuera. */
  filtros: FiltrosGastos;
  onChange: (filtros: FiltrosGastos) => void;
  /** Se llama cuando hay que volver a consultar: al dejar de escribir o al cambiar una fecha. */
  onBuscar: (filtros: FiltrosGastos) => void;
}

const DEBOUNCE_MS = 350;

const dateInput: React.CSSProperties = {
  border: "none",
  background: "none",
  outline: "none",
  padding: 0,
  fontSize: 13,
  color: "var(--color-text-primary)",
  width: 118,
};

/**
 * Buscador de proveedor y rango de fechas del historial. Filtra solo: mientras se
 * escribe (con debounce) y al elegir una fecha, sin botón "buscar".
 */
export default function FiltrosHistorial({ filtros, onChange, onBuscar }: Props) {
  const [errorFechas, setErrorFechas] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  // Si el padre borra los filtros, cancela la búsqueda pendiente para que no los vuelva a aplicar.
  useEffect(() => {
    if (filtros.proveedor || filtros.desde || filtros.hasta) return;
    if (debounce.current) {
      clearTimeout(debounce.current);
      debounce.current = null;
    }
    setErrorFechas(null);
  }, [filtros.proveedor, filtros.desde, filtros.hasta]);

  function rangoValido(f: FiltrosGastos) {
    // Las fechas AAAA-MM-DD se pueden comparar como texto
    return !(f.desde && f.hasta && f.desde > f.hasta);
  }

  function cambiarProveedor(valor: string) {
    const next = { ...filtros, proveedor: valor };
    onChange(next);
    if (debounce.current) clearTimeout(debounce.current);
    if (!rangoValido(next)) return;
    debounce.current = setTimeout(() => onBuscar({ ...next, proveedor: valor.trim() }), DEBOUNCE_MS);
  }

  function cambiarFecha(campo: "desde" | "hasta", valor: string) {
    const next = { ...filtros, [campo]: valor };
    onChange(next);
    if (debounce.current) clearTimeout(debounce.current);
    if (!rangoValido(next)) {
      setErrorFechas("la fecha «desde» no puede ser posterior a «hasta».");
      return;
    }
    setErrorFechas(null);
    onBuscar({ ...next, proveedor: next.proveedor.trim() });
  }

  return (
    <>
      <div style={{ position: "relative", width: 220 }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", color: "var(--color-text-secondary)", pointerEvents: "none" }}>
          <Icon name="search" size={16} />
        </span>
        <input
          id="filtro-proveedor"
          type="text"
          role="searchbox"
          aria-label="buscar proveedor"
          placeholder="buscar proveedor"
          value={filtros.proveedor}
          onChange={(e) => cambiarProveedor(e.target.value)}
          className="input"
          style={{ padding: "7px 10px 7px 32px" }}
        />
      </div>

      <div
        role="group"
        aria-label="rango de fechas"
        aria-describedby={errorFechas ? "filtro-fechas-error" : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 10px",
          border: `1px solid ${errorFechas ? "var(--color-warning-text)" : "var(--color-border)"}`,
          borderRadius: "var(--radius-md)",
          backgroundColor: "var(--color-surface-input)",
        }}
      >
        <input id="filtro-desde" type="date" aria-label="desde" value={filtros.desde} max={filtros.hasta || undefined} onChange={(e) => cambiarFecha("desde", e.target.value)} style={dateInput} />
        <span aria-hidden="true" style={{ color: "var(--color-text-secondary)" }}>–</span>
        <input id="filtro-hasta" type="date" aria-label="hasta" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => cambiarFecha("hasta", e.target.value)} style={dateInput} />
      </div>

      {errorFechas && (
        <p id="filtro-fechas-error" role="alert" className="field-error" style={{ margin: 0, flexBasis: "100%", order: 10 }}>
          <Icon name="error" size={14} />
          {errorFechas}
        </p>
      )}
    </>
  );
}
