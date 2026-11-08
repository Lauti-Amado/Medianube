"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import { useAuth } from "../../lib/auth-context";
import {
  sugerirPreciosConIA,
  TICKETS_PREDETERMINADOS,
  type ResultadoPrecios,
  type Ticket,
  type ItemTicket,
} from "../../lib/precios";
import EstadoApi from "../../src/src/components/ui/EstadoApi";

// ── Shared styles matching medianube Design System ───────────────────────────

const iconStyle: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "16px",
  lineHeight: 1,
  userSelect: "none",
};

const badgeStyle = (bg: string, text: string): React.CSSProperties => ({
  backgroundColor: bg,
  color: text,
  fontSize: "11px",
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: "var(--radius-full)",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  whiteSpace: "nowrap",
});

const sectionCard: React.CSSProperties = {
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  padding: "18px 20px",
  boxSizing: "border-box",
};

function formatARS(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "-";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function labelMotivo(motivo: string | null): string {
  switch (motivo) {
    case "sin_api_key":
      return "Motor de IA sin clave configurada en el servidor";
    case "sin_tiempo":
      return "Tiempo límite de respuesta alcanzado";
    case "timeout":
      return "El motor de IA demoró más del tiempo esperado";
    case "no_disponible":
      return "Servicio de IA no disponible temporalmente";
    default:
      return motivo || "Reglas comerciales automáticas";
  }
}

export default function PreciosPage() {
  const { user } = useAuth();

  // ── States ──────────────────────────────────────────────────────────────────
  const [ticketActual, setTicketActual] = useState<Ticket>(TICKETS_PREDETERMINADOS[0].ticket);
  const [presetSeleccionado, setPresetSeleccionado] = useState<string>(TICKETS_PREDETERMINADOS[0].id);
  const [panelTicketAbierto, setPanelTicketAbierto] = useState<boolean>(false);

  const [resultado, setResultado] = useState<ResultadoPrecios | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "ajustar" | "estable">("todos");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todas");

  // Local applied state
  const [preciosAplicados, setPreciosAplicados] = useState<Set<string>>(new Set());

  // ── Fetch Suggestions ───────────────────────────────────────────────────────
  const consultarSugerencias = useCallback(
    async (ticketAEnviar: Ticket) => {
      setLoading(true);
      setError(null);
      try {
        const res = await sugerirPreciosConIA(ticketAEnviar, user?.sub);
        setResultado(res);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al conectar con el servicio de precios.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [user?.sub]
  );

  useEffect(() => {
    void consultarSugerencias(ticketActual);
  }, [consultarSugerencias]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSeleccionarPreset = (presetId: string) => {
    setPresetSeleccionado(presetId);
    const encontrado = TICKETS_PREDETERMINADOS.find((p) => p.id === presetId);
    if (encontrado) {
      setTicketActual(encontrado.ticket);
      void consultarSugerencias(encontrado.ticket);
    }
  };

  const handleModificarItemTicket = (index: number, campo: keyof ItemTicket, valor: string | number) => {
    setTicketActual((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [campo]: valor };
      return { ...prev, items };
    });
  };

  const handleAgregarItemTicket = () => {
    setTicketActual((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { descripcion: "Nuevo insumo", cantidad: 1, precioUnitario: 1000, unidad: "u" },
      ],
    }));
  };

  const handleQuitarItemTicket = (index: number) => {
    setTicketActual((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleAplicarPrecio = (productoID: string) => {
    setPreciosAplicados((prev) => new Set(prev).add(productoID));
  };

  // ── Filtering Logic ────────────────────────────────────────────────────────
  const sugerencias = resultado?.sugerencias ?? [];

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const s of sugerencias) {
      if (s.categoria) set.add(s.categoria);
    }
    return Array.from(set);
  }, [sugerencias]);

  const sugerenciasFiltradas = useMemo(() => {
    return sugerencias.filter((item) => {
      if (filtroEstado === "ajustar" && item.estado !== "ajustar") return false;
      if (filtroEstado === "estable" && item.estado !== "estable") return false;
      if (categoriaSeleccionada !== "todas" && item.categoria !== categoriaSeleccionada) return false;
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase();
        const coincideNombre = item.nombre.toLowerCase().includes(query);
        const coincideInsumo = item.insumosAfectados?.some((i) => i.toLowerCase().includes(query)) ?? false;
        if (!coincideNombre && !coincideInsumo) return false;
      }
      return true;
    });
  }, [sugerencias, filtroEstado, categoriaSeleccionada, busqueda]);

  // KPIs
  const totalAjustar = sugerencias.filter((s) => s.estado === "ajustar").length;
  const totalEstable = sugerencias.filter((s) => s.estado === "estable").length;
  const promedioAumento = useMemo(() => {
    const aAjustar = sugerencias.filter((s) => s.estado === "ajustar" && s.variacionPct > 0);
    if (aAjustar.length === 0) return 0;
    const suma = aAjustar.reduce((acc, cur) => acc + cur.variacionPct, 0);
    return suma / aAjustar.length;
  }, [sugerencias]);

  return (
    <AppLayout activeTab="precios">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1200px" }}>

        {/* ── 1. Page Header ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--color-text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
                Sugerencias de Precios con IA
              </h1>
              <span style={badgeStyle("var(--color-accent-tint)", "var(--color-accent-dark)")}>
                <span style={{ ...iconStyle, fontSize: "13px" }}>auto_awesome</span>
                Motor IA
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
              Precios sugeridos según costos de reposición en facturas, recetas y márgenes de ganancia.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setPanelTicketAbierto((prev) => !prev)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: panelTicketAbierto ? "var(--color-neutral-bg)" : "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text-primary)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <span style={iconStyle}>receipt_long</span>
              {panelTicketAbierto ? "Ocultar ticket analizado" : "Ver / Cambiar ticket"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => void consultarSugerencias(ticketActual)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                backgroundColor: "var(--color-accent)",
                border: "none",
                borderRadius: "var(--radius-md)",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "var(--color-accent-dark)";
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "var(--color-accent)";
              }}
            >
              <span style={{ ...iconStyle, fontSize: "15px" }}>refresh</span>
              {loading ? "Calculando sugerencias..." : "Recalcular con IA"}
            </button>
          </div>
        </div>

        {/* ── 2. Collapsible Ticket Configuration Panel ─────────────────────── */}
        {panelTicketAbierto && (
          <div style={{ ...sectionCard, backgroundColor: "#FFFDFB", borderColor: "var(--color-border-strong)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                  Ticket de Compra Evaluado
                </h3>
                <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: "2px 0 0" }}>
                  Seleccioná una factura de ejemplo o modificá las líneas para analizar el impacto de aumentos.
                </p>
              </div>

              {/* Presets dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Plantillas:</span>
                <select
                  value={presetSeleccionado}
                  onChange={(e) => handleSeleccionarPreset(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    fontSize: "12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {TICKETS_PREDETERMINADOS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                  <option value="custom">Ticket Personalizado</option>
                </select>
              </div>
            </div>

            {/* Ticket Header Inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "4px" }}>
                  PROVEEDOR
                </label>
                <input
                  type="text"
                  value={ticketActual.proveedor || ""}
                  onChange={(e) => {
                    setPresetSeleccionado("custom");
                    setTicketActual((prev) => ({ ...prev, proveedor: e.target.value }));
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: "13px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    boxSizing: "border-box",
                  }}
                  placeholder="Ej: Distribuidora Sur S.A."
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: "4px" }}>
                  FECHA FACTURA
                </label>
                <input
                  type="date"
                  value={ticketActual.fecha || ""}
                  onChange={(e) => {
                    setPresetSeleccionado("custom");
                    setTicketActual((prev) => ({ ...prev, fecha: e.target.value }));
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: "13px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Ticket Items Table */}
            <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden", backgroundColor: "var(--color-surface)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>Descripción del Insumo / Bulto</th>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)", width: "90px" }}>Cantidad</th>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)", width: "140px" }}>Precio Unitario ($)</th>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)", width: "50px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {ticketActual.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < ticketActual.items.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                      <td style={{ padding: "6px 12px" }}>
                        <input
                          type="text"
                          value={item.descripcion}
                          onChange={(e) => {
                            setPresetSeleccionado("custom");
                            handleModificarItemTicket(idx, "descripcion", e.target.value);
                          }}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            fontSize: "12px",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-sm)",
                            boxSizing: "border-box",
                          }}
                          placeholder="Ej: Harina 000 x 25 kg"
                        />
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => {
                            setPresetSeleccionado("custom");
                            handleModificarItemTicket(idx, "cantidad", Number(e.target.value) || 1);
                          }}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            fontSize: "12px",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-sm)",
                            boxSizing: "border-box",
                          }}
                        />
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <input
                          type="number"
                          min="1"
                          value={item.precioUnitario}
                          onChange={(e) => {
                            setPresetSeleccionado("custom");
                            handleModificarItemTicket(idx, "precioUnitario", Number(e.target.value) || 0);
                          }}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            fontSize: "12px",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-sm)",
                            boxSizing: "border-box",
                          }}
                        />
                      </td>
                      <td style={{ padding: "6px 12px", textAlign: "center" }}>
                        {ticketActual.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleQuitarItemTicket(idx)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-warning-text)", padding: "4px" }}
                            title="Quitar ítem"
                          >
                            <span style={{ ...iconStyle, fontSize: "16px" }}>delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions for Ticket */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
              <button
                type="button"
                onClick={handleAgregarItemTicket}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "12px",
                  color: "var(--color-accent)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                <span style={{ ...iconStyle, fontSize: "14px" }}>add</span>
                Agregar otro insumo
              </button>

              <button
                type="button"
                onClick={() => void consultarSugerencias(ticketActual)}
                style={{
                  padding: "6px 14px",
                  backgroundColor: "var(--color-accent)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Analizar este ticket con IA →
              </button>
            </div>
          </div>
        )}

        <EstadoApi
          loading={loading}
          loadingLabel="Analizando variaciones de costos con la IA…"
          error={error}
          errorTitle="Error al obtener las sugerencias de precios"
          onRetry={() => void consultarSugerencias(ticketActual)}
          origen={resultado?.degradado ? "reglas" : resultado?.origen ?? null}
          mensajeReglas={
            <>
              <strong>Sin datos de IA.</strong> La Lambda devolvió origen &quot;reglas&quot;
              {resultado?.motivoDegradacion
                ? ` (${labelMotivo(resultado.motivoDegradacion)})`
                : ""}
              . Las sugerencias salen de las reglas de rentabilidad, no de un modelo de lenguaje.
            </>
          }
          mensajeIa={
            <>
              <strong>Datos con IA.</strong> Las sugerencias las generó el modelo a partir del ticket,
              recetas y márgenes enviados a la Lambda.
              {resultado?.guardado ? " Sincronizado en catálogo." : ""}
            </>
          }
        >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ── 4. KPI Summary Cards ─────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {/* Card 1: Productos a ajustar */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Ajuste urgente
              </span>
              <span style={{ ...iconStyle, color: totalAjustar > 0 ? "var(--color-warning-text)" : "var(--color-success-text)" }}>
                {totalAjustar > 0 ? "warning" : "verified"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "24px", fontWeight: 700, color: totalAjustar > 0 ? "var(--color-warning-text)" : "var(--color-text-primary)" }}>
                {loading ? "..." : totalAjustar}
              </span>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>productos</span>
            </div>
            <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
              {totalAjustar > 0 ? "Margen comprometido por aumentos" : "Todos los márgenes dentro del objetivo"}
            </p>
          </div>

          {/* Card 2: Productos estables */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Precios estables
              </span>
              <span style={{ ...iconStyle, color: "var(--color-success-text)" }}>check</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                {loading ? "..." : totalEstable}
              </span>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>productos</span>
            </div>
            <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
              Variación de costo menor al 2%
            </p>
          </div>

          {/* Card 3: Aumento promedio sugerido */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Aumento promedio
              </span>
              <span style={{ ...iconStyle, color: "var(--color-accent)" }}>trending_up</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                {loading ? "..." : promedioAumento > 0 ? `+${promedioAumento.toFixed(1)}%` : "0%"}
              </span>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>en productos a ajustar</span>
            </div>
            <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
              Mantiene el margen objetivo del negocio
            </p>
          </div>

          {/* Card 4: Insumos vinculados */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Insumos impactados
              </span>
              <span style={{ ...iconStyle, color: "var(--color-text-muted)" }}>inventory_2</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                {loading ? "..." : resultado?.insumos?.length ?? 0}
              </span>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>en recetas evaluadas</span>
            </div>
            <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
              Emparejados contra el ticket de compra
            </p>
          </div>
        </div>

        {/* ── 6. Filters & Search Bar ──────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          {/* Tabs: Todos, Ajustar, Estables */}
          <div style={{ display: "flex", gap: "6px", backgroundColor: "var(--color-neutral-bg)", padding: "3px", borderRadius: "var(--radius-md)" }}>
            <button
              type="button"
              onClick={() => setFiltroEstado("todos")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: filtroEstado === "todos" ? 600 : 400,
                backgroundColor: filtroEstado === "todos" ? "var(--color-surface)" : "transparent",
                color: filtroEstado === "todos" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Todos ({sugerencias.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("ajustar")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: filtroEstado === "ajustar" ? 600 : 400,
                backgroundColor: filtroEstado === "ajustar" ? "var(--color-surface)" : "transparent",
                color: filtroEstado === "ajustar" ? "var(--color-warning-text)" : "var(--color-text-secondary)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Requieren ajuste ({totalAjustar})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("estable")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: filtroEstado === "estable" ? 600 : 400,
                backgroundColor: filtroEstado === "estable" ? "var(--color-surface)" : "transparent",
                color: filtroEstado === "estable" ? "var(--color-success-text)" : "var(--color-text-secondary)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Estables ({totalEstable})
            </button>
          </div>

          {/* Search box & Category filter */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {categorias.length > 0 && (
              <select
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                style={{
                  padding: "7px 10px",
                  fontSize: "12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-text-primary)",
                  cursor: "pointer",
                }}
              >
                <option value="todas">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            <div style={{ position: "relative", minWidth: "220px" }}>
              <input
                type="text"
                placeholder="Buscar por producto o insumo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 30px",
                  fontSize: "12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-text-primary)",
                  boxSizing: "border-box",
                }}
              />
              <span
                style={{
                  ...iconStyle,
                  position: "absolute",
                  left: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--color-text-muted)",
                  fontSize: "15px",
                }}
              >
                search
              </span>
            </div>
          </div>
        </div>

        {/* ── 7. Price Suggestions Cards Grid ──────────────────────────────── */}
        {sugerenciasFiltradas.length === 0 && (
          <div style={{ ...sectionCard, textAlign: "center", padding: "40px" }}>
            <span style={{ ...iconStyle, fontSize: "32px", color: "var(--color-text-muted)" }}>
              sell
            </span>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-primary)", marginTop: "8px" }}>
              No se encontraron sugerencias de precios con los filtros actuales.
            </p>
            <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "4px 0 12px" }}>
              Probá restableciendo los filtros o analizando otro ticket de compra.
            </p>
            <button
              type="button"
              onClick={() => {
                setFiltroEstado("todos");
                setCategoriaSeleccionada("todas");
                setBusqueda("");
              }}
              style={{
                padding: "6px 14px",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                color: "var(--color-text-primary)",
                cursor: "pointer",
              }}
            >
              Restablecer filtros
            </button>
          </div>
        )}

        {sugerenciasFiltradas.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
            {sugerenciasFiltradas.map((item) => {
              const estaAplicado = preciosAplicados.has(item.productoID);
              const esAjuste = item.estado === "ajustar";

              return (
                <div
                  key={item.productoID}
                  style={{
                    ...sectionCard,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    borderLeft: esAjuste ? "4px solid var(--color-warning-text)" : "4px solid var(--color-border)",
                  }}
                >
                  {/* Card Header */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {item.categoria || "PRODUCTO"}
                      </span>

                      <div style={{ display: "flex", gap: "6px" }}>
                        {/* Status Badge */}
                        {esAjuste ? (
                          <span style={badgeStyle("var(--color-warning-bg)", "var(--color-warning-text)")}>
                            ⚠️ Ajustar {formatPct(item.variacionPct)}
                          </span>
                        ) : (
                          <span style={badgeStyle("var(--color-success-bg)", "var(--color-success-text)")}>
                            ✓ Estable
                          </span>
                        )}

                        {/* Confidence Badge */}
                        <span
                          style={badgeStyle(
                            item.confianza === "alta"
                              ? "var(--color-success-bg)"
                              : item.confianza === "media"
                              ? "var(--color-neutral-bg)"
                              : "var(--color-warning-bg)",
                            item.confianza === "alta"
                              ? "var(--color-success-text)"
                              : item.confianza === "media"
                              ? "var(--color-neutral-text)"
                              : "var(--color-warning-text)"
                          )}
                          title={`Confianza del análisis: ${item.confianza}`}
                        >
                          {item.confianza === "alta" ? "Alta" : item.confianza === "media" ? "Media" : "Baja"}
                        </span>
                      </div>
                    </div>

                    <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
                      {item.nombre}
                    </h2>

                    {/* Affected ingredients pills */}
                    {(item.insumosAfectados?.length ?? 0) > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Insumos:</span>
                        {item.insumosAfectados?.map((insumo) => (
                          <span
                            key={insumo}
                            style={{
                              fontSize: "10px",
                              backgroundColor: "var(--color-bg)",
                              color: "var(--color-text-secondary)",
                              padding: "1px 6px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--color-border-subtle)",
                            }}
                          >
                            {insumo}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pricing Comparison Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "8px",
                      backgroundColor: "var(--color-bg)",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border-subtle)",
                      textAlign: "center",
                    }}
                  >
                    {/* Costo Receta */}
                    <div>
                      <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", margin: "0 0 2px" }}>
                        Costo Receta
                      </p>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                        {formatARS(item.costoNuevo)}
                      </p>
                      {item.costoAnterior !== null && (
                        <p style={{ fontSize: "10px", color: "var(--color-text-secondary)", margin: "2px 0 0" }}>
                          era {formatARS(item.costoAnterior)}
                        </p>
                      )}
                    </div>

                    {/* Precio Venta Actual */}
                    <div>
                      <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", margin: "0 0 2px" }}>
                        Precio Actual
                      </p>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", margin: 0 }}>
                        {formatARS(item.precioActual)}
                      </p>
                      <p style={{ fontSize: "10px", color: "var(--color-text-muted)", margin: "2px 0 0" }}>
                        vigente
                      </p>
                    </div>

                    {/* Precio Sugerido */}
                    <div>
                      <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-accent-dark)", textTransform: "uppercase", margin: "0 0 2px" }}>
                        Sugerido IA
                      </p>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: esAjuste ? "var(--color-warning-text)" : "var(--color-success-text)", margin: 0 }}>
                        {formatARS(item.precioSugerido)}
                      </p>
                      {item.margenResultante !== null && (
                        <p style={{ fontSize: "10px", fontWeight: 500, color: "var(--color-text-secondary)", margin: "2px 0 0" }}>
                          margen {(item.margenResultante * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  </div>

                  {/* AI Explanation / Reasoning Box */}
                  <div
                    style={{
                      padding: "10px 12px",
                      backgroundColor: "var(--color-accent-tint)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "12px",
                      lineHeight: "1.45",
                      color: "var(--color-text-callout)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
                      <span style={{ ...iconStyle, fontSize: "14px", color: "var(--color-accent-dark)" }}>auto_awesome</span>
                      <strong style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-accent-dark)" }}>
                        {item.origen === "llm" ? "Análisis de la IA:" : "Cálculo por reglas de margen:"}
                      </strong>
                    </div>
                    <p style={{ margin: 0 }}>{item.justificacion}</p>
                    {item.ajustadoPorReglas && (
                      <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-warning-text)", marginTop: "4px", marginBottom: 0 }}>
                        🛡️ Precio ajustado por guardas comerciales de seguridad.
                      </p>
                    )}
                  </div>

                  {/* Card Action */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "10px" }}>
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                      {esAjuste ? "Ajuste recomendado" : "No requiere cambios"}
                    </span>

                    <button
                      type="button"
                      disabled={estaAplicado}
                      onClick={() => handleAplicarPrecio(item.productoID)}
                      style={{
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor: estaAplicado ? "var(--color-success-bg)" : "var(--color-accent)",
                        color: estaAplicado ? "var(--color-success-text)" : "#FFFFFF",
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        cursor: estaAplicado ? "default" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      {estaAplicado ? (
                        <>
                          <span style={{ ...iconStyle, fontSize: "14px" }}>check</span>
                          Aplicado
                        </>
                      ) : (
                        <>
                          <span style={{ ...iconStyle, fontSize: "14px" }}>done_all</span>
                          Aplicar precio
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 8. Ingredients Cost Variations Table ─────────────────────────── */}
        {(resultado?.insumos?.length ?? 0) > 0 && (
          <div style={{ ...sectionCard, marginTop: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ ...iconStyle, color: "var(--color-accent)" }}>query_stats</span>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                Insumos Emparejados y Variaciones de Costo
              </h3>
            </div>
            <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: "0 0 14px" }}>
              Variación de precios unitarios normalizados detectada entre el ticket y las compras anteriores en el sistema.
            </p>

            <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left", whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>Insumo Receta</th>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>Descripción en Ticket</th>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>Unidad</th>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>Precio Anterior</th>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>Precio Nuevo</th>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>Variación vs Última</th>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>Variación vs Promedio</th>
                    <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>Certeza</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado?.insumos?.map((v, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: i < (resultado.insumos?.length ?? 0) - 1 ? "1px solid var(--color-border-subtle)" : "none",
                        backgroundColor: i % 2 === 1 ? "#FDF9F5" : "var(--color-surface)",
                      }}
                    >
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-primary)" }}>{v.insumo}</td>
                      <td style={{ padding: "8px 12px", color: "var(--color-text-secondary)" }}>{v.descripcionTicket}</td>
                      <td style={{ padding: "8px 12px", color: "var(--color-text-muted)" }}>${`/${v.unidad}`}</td>
                      <td style={{ padding: "8px 12px", color: "var(--color-text-secondary)" }}>{formatARS(v.precioAnterior)}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-primary)" }}>{formatARS(v.precioNuevo)}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: v.variacionPct && v.variacionPct > 0 ? "var(--color-warning-text)" : "var(--color-text-secondary)",
                          }}
                        >
                          {formatPct(v.variacionPct)}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "var(--color-text-secondary)" }}>{formatPct(v.variacionVsPromedioPct)}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span
                          style={badgeStyle(
                            v.certeza === "alta" ? "var(--color-success-bg)" : "var(--color-neutral-bg)",
                            v.certeza === "alta" ? "var(--color-success-text)" : "var(--color-neutral-text)"
                          )}
                        >
                          {v.certeza}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 9. Notice for Products Without Recipe ────────────────────────── */}
        {(resultado?.productosSinReceta?.length ?? 0) > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "12px 16px",
              backgroundColor: "var(--color-neutral-bg)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              fontSize: "12px",
              color: "var(--color-text-secondary)",
            }}
          >
            <span style={{ ...iconStyle, color: "var(--color-text-muted)" }}>help_outline</span>
            <div>
              <strong style={{ color: "var(--color-text-primary)" }}>Productos pendientes de receta:</strong>{" "}
              {resultado?.productosSinReceta?.join(", ") ?? ""}. Estos productos no pudieron ser evaluados porque no tienen ingredientes cargados en su receta. Podés configurarlos desde la pantalla de Configuración.
            </div>
          </div>
        )}

        </div>
        </EstadoApi>

      </div>
    </AppLayout>
  );
}
