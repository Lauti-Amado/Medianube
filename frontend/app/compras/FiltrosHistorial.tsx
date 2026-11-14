"use client";

import { useState } from "react";
import Button from "../../src/src/components/ui/Button";

export interface FiltrosGastos {
  proveedor: string;
  desde: string;
  hasta: string;
}

export const FILTROS_VACIOS: FiltrosGastos = { proveedor: "", desde: "", hasta: "" };

interface Props {
  isLoading: boolean;
  onBuscar: (filtros: FiltrosGastos) => void;
}

const icon: React.CSSProperties = { fontFamily: "Material Symbols Outlined", fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20", fontSize: "14px", lineHeight: 1, userSelect: "none" };

const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)" };

const input: React.CSSProperties = { fontSize: 13, border: "1px solid var(--color-border)", borderRadius: 8, backgroundColor: "var(--color-surface-input)", color: "var(--color-text-primary)", padding: "8px 10px", outline: "none", boxSizing: "border-box", fontWeight: 400 };

export default function FiltrosHistorial({ isLoading, onBuscar }: Props) {
  const [filtros, setFiltros] = useState<FiltrosGastos>(FILTROS_VACIOS);
  const [errorFechas, setErrorFechas] = useState<string | null>(null);

  const actualizar = (campo: keyof FiltrosGastos, valor: string) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
    setErrorFechas(null);
  };

  const buscar = () => {
    // Las fechas AAAA-MM-DD se pueden comparar como texto
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setErrorFechas("La fecha \"Desde\" no puede ser posterior a \"Hasta\".");
      return;
    }
    onBuscar({ ...filtros, proveedor: filtros.proveedor.trim() });
  };

  const limpiar = () => {
    setFiltros(FILTROS_VACIOS);
    setErrorFechas(null);
    onBuscar(FILTROS_VACIOS);
  };

  return (
    <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)", padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <label style={{ ...label, flex: 1, minWidth: 220 }}>
          Proveedor
          <input id="filtro-proveedor" type="text" placeholder="Ej: Molino San Justo" value={filtros.proveedor}
            onChange={(e) => actualizar("proveedor", e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
            style={{ ...input, width: "100%" }} />
        </label>
        <label style={label}>
          Desde
          <input id="filtro-desde" type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={(e) => actualizar("desde", e.target.value)} style={input} />
        </label>
        <label style={label}>
          Hasta
          <input id="filtro-hasta" type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => actualizar("hasta", e.target.value)} style={input} />
        </label>
        <Button id="btn-buscar-compras" variant="primary" icon="search" onClick={buscar} disabled={isLoading}>
          {isLoading ? "buscando…" : "buscar"}
        </Button>
        <Button id="btn-limpiar-filtros" icon="filter_alt_off" onClick={limpiar} disabled={isLoading}>
          limpiar
        </Button>
      </div>
      {errorFechas && (
        <div role="alert" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-warning-text)", marginTop: 10 }}>
          <span style={{ ...icon, fontSize: 14 }}>error</span>{errorFechas}
        </div>
      )}
    </div>
  );
}
