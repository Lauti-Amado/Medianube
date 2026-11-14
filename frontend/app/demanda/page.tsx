"use client";

import { useState, useEffect } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import EstadoApi from "../../src/src/components/ui/EstadoApi";

// ── Types ─────────────────────────────────────────────────────────────────────

type Confidence = "alta" | "media" | "baja";

interface DayBar {
  label: string;
  value: number;
  predicted: boolean;
}

interface Recommendation {
  id: string;
  product: string;
  qty: number;
  unit: string;
  confidence: Confidence;
  risk?: boolean;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────
const API_URL = "https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com/demanda?usuarioID=user_test_123";
const CLIMA_URL = "https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com/clima?usuarioID=user_test_123";
const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const UNIT_LABEL: Record<string, string> = {
  unidad: "u.",
  kg: "kg",
  porcion: "porciones",
  vaso: "u.",
};

interface ProductoApi {
  productoID: string;
  nombre: string;
  unidadProducto?: string;
  cantidad: number;
  confianza?: string;
  fecha?: string;
}

interface DemandaApiResponse {
  origen?: string;
  produccion?: ProductoApi[];
  precision?: number | null;
}

interface DiaClima {
  fecha: string;
  tempMax: number | null;
  tempMin: number | null;
  probLluvia: number | null;
  precipitacionMm: number | null;
  descripcion: string;
}

interface ClimaApiResponse {
  origen?: string;
  disponible?: boolean;
  aviso?: string | null;
  ubicacion?: { ciudad?: string | null };
  dias?: DiaClima[];
}

function etiquetaDia(fecha: string): string {
  return DIAS_SEMANA[new Date(`${fecha}T12:00:00`).getDay()] ?? fecha;
}

function asConfidence(valor: string | undefined): Confidence {
  if (valor === "alta" || valor === "media" || valor === "baja") return valor;
  return "media";
}

function mapProduccion(items: ProductoApi[]): Recommendation[] {
  return items.map((item) => {
    const confidence = asConfidence(item.confianza);
    return {
      id: item.productoID + (item.fecha ? `-${item.fecha}` : ""),
      product: item.nombre,
      qty: item.cantidad,
      unit: item.unidadProducto ? (UNIT_LABEL[item.unidadProducto] ?? item.unidadProducto) : "u.",
      confidence,
      risk: confidence === "baja",
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONF_STYLE: Record<Confidence, React.CSSProperties> = {
  alta:  { backgroundColor: "var(--color-success-bg)", color: "var(--color-success-text)" },
  media: { backgroundColor: "var(--color-neutral-bg)",  color: "var(--color-neutral-text)"  },
  baja:  { backgroundColor: "var(--color-warning-bg)", color: "var(--color-warning-text)" },
};

const icon: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "14px",
  lineHeight: 1,
  userSelect: "none",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DemandaPage() {
  const [recalculating, setRecalculating] = useState(false);
  const [recomendaciones, setRecomendaciones] = useState<Recommendation[]>([]);
  const [kpiDatos, setKpiDatos] = useState<{ produccionTotal: string; precision: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [origen, setOrigen] = useState<string | null>(null);

  const [barsData, setBarsData] = useState<DayBar[]>([]);

  const [clima, setClima] = useState<DiaClima[]>([]);
  const [climaCiudad, setClimaCiudad] = useState<string | null>(null);
  const [climaLoading, setClimaLoading] = useState(true);
  const [climaError, setClimaError] = useState("");
  const [climaAviso, setClimaAviso] = useState<string | null>(null);
  const [climaOrigen, setClimaOrigen] = useState<string | null>(null);

  async function fetchPrediccion() {
    setErrorMsg("");
    setOrigen(null);
    try {
      const response = await fetch(API_URL, {
        method: "GET",
      });
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      const data = (await response.json()) as DemandaApiResponse;
      setOrigen(data.origen ?? null);

      const productos = data.produccion ?? [];
      const mapped = mapProduccion(productos);
      setRecomendaciones(mapped);

      const totalUnidades = mapped.reduce((acc, r) => acc + r.qty, 0);
      setKpiDatos({
        produccionTotal: `${totalUnidades.toLocaleString("es-AR")} u.`,
        precision: data.precision != null ? `${(data.precision * 100).toFixed(1)}%` : "-",
      });

      const porFecha = new Map<string, number>();
      for (const p of productos) {
        if (!p.fecha) continue;
        porFecha.set(p.fecha, (porFecha.get(p.fecha) ?? 0) + p.cantidad);
      }
      setBarsData(
        [...porFecha.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([fecha, value]) => ({
            label: DIAS_SEMANA[new Date(`${fecha}T12:00:00`).getDay()],
            value,
            predicted: true,
          }))
      );
    } catch (error) {
      console.error("Error al obtener predicciones:", error);
      setRecomendaciones([]);
      setErrorMsg("No se pudo cargar la predicción de demanda desde la base de datos.");
    } finally {
      setIsLoading(false);
      setRecalculating(false);
    }
  }

  async function fetchClima() {
    setClimaError("");
    setClimaAviso(null);
    try {
      const response = await fetch(CLIMA_URL, { method: "GET" });
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = (await response.json()) as ClimaApiResponse;
      setClima(data.dias ?? []);
      setClimaCiudad(data.ubicacion?.ciudad ?? null);
      setClimaOrigen(data.origen ?? null);
      setClimaAviso(data.aviso ?? null);
      if (data.disponible === false) {
        setClimaError(data.aviso ?? "El pronóstico no está disponible en este momento.");
      }
    } catch (error) {
      console.error("Error al obtener el clima:", error);
      setClima([]);
      setClimaError("No se pudo cargar el pronóstico del clima.");
    } finally {
      setClimaLoading(false);
    }
  }

  useEffect(() => {
    void fetchPrediccion();
    void fetchClima();
  }, []);

  const handleRecalculate = () => {
    setRecalculating(true);
    setIsLoading(true);
    setClimaLoading(true);
    void fetchPrediccion();
    void fetchClima();
  };

  const atRisk = recomendaciones.filter((r) => r.risk).length;
  const MAX_VAL = barsData.length > 0 ? Math.max(...barsData.map((b) => b.value)) : 100;

  return (
    <AppLayout activeTab="demanda">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>Predicción de demanda</h1>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0" }}>Proyección para los próximos 7 días · basada en historial de ventas</p>
          </div>
          <button
            id="btn-recalcular-demanda"
            onClick={handleRecalculate}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              backgroundColor: "var(--color-accent)", color: "#fff",
              fontSize: 13, fontWeight: 500, padding: "9px 16px",
              borderRadius: 8, border: "none", cursor: "pointer",
              opacity: recalculating ? 0.7 : 1, transition: "opacity 0.2s",
            }}
          >
            <span style={{ ...icon, fontSize: 15, animation: recalculating ? "spin 1s linear infinite" : "none" }}>autorenew</span>
            {recalculating ? "Actualizando…" : "Actualizar"}
          </button>
        </div>

        {/* ── KPIs ────────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Producción total prevista", value: isLoading ? "..." : kpiDatos?.produccionTotal || "-", sub: "para los próximos 7 días", warn: false },
            { label: "Precisión del modelo", value: isLoading ? "..." : kpiDatos?.precision || "-", sub: "backtest de los últimos 7 días", warn: false },
            { label: "Productos en riesgo de faltante", value: isLoading ? "..." : String(atRisk), sub: "con baja confianza de predicción", warn: true },
          ].map((kpi) => (
            <div key={kpi.label} style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "14px 16px" }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 8 }}>{kpi.label}</span>
              <div style={{ fontSize: 24, fontWeight: 500, color: kpi.warn ? "var(--color-warning-text)" : "var(--color-text-primary)", marginBottom: 4 }}>{kpi.value}</div>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{kpi.sub}</span>
            </div>
          ))}
        </div>

        {/* ── Pronóstico del clima ─────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <EstadoApi
            loading={climaLoading}
            loadingLabel="Cargando pronóstico…"
            error={climaError || null}
            errorTitle="No se pudo obtener el pronóstico del clima"
            onRetry={() => { setClimaLoading(true); void fetchClima(); }}
            origen={climaOrigen}
          >
            <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                  Pronóstico{climaCiudad ? ` · ${climaCiudad}` : ""}
                </span>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  Con lluvia (≥ 60 % o ≥ 2 mm) el modelo reduce la producción prevista
                </span>
              </div>
              {climaAviso && (
                <div style={{ fontSize: 11, color: "var(--color-warning-text)", marginBottom: 10 }}>{climaAviso}</div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                {clima.map((d) => {
                  const llueve = (d.probLluvia ?? 0) >= 60 || (d.precipitacionMm ?? 0) >= 2;
                  return (
                    <div
                      key={d.fecha}
                      style={{
                        textAlign: "center", padding: "10px 4px", borderRadius: 8,
                        border: "1px solid var(--color-border)",
                        backgroundColor: llueve ? "var(--color-warning-bg)" : "transparent",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>{etiquetaDia(d.fecha)}</div>
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 6 }}>{d.fecha.slice(8, 10)}/{d.fecha.slice(5, 7)}</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>{d.tempMax != null ? `${Math.round(d.tempMax)}°` : "-"}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{d.tempMin != null ? `${Math.round(d.tempMin)}°` : "-"}</div>
                      <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 6 }}>{d.descripcion}</div>
                      <div style={{ fontSize: 10, color: llueve ? "var(--color-warning-text)" : "var(--color-text-muted)" }}>
                        {d.probLluvia != null ? `${d.probLluvia} % lluvia` : "-"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </EstadoApi>
        </div>

        {/* ── Gráfico de barras ─────────────────────────────────────────── */}
        <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Producción prevista por día</span>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "var(--color-bar-predicted)" }} />
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Predicción</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 0, height: 140, position: "relative", borderBottom: "1px solid var(--color-border)" }}>
            {[25, 50, 75].map((pct) => (
              <div key={pct} style={{ position: "absolute", left: 0, right: 0, bottom: `${pct}%`, borderTop: "1px dashed #F0E4D4", zIndex: 0 }} />
            ))}
            {barsData.map((bar, idx) => {
              const barHeight = Math.round((bar.value / MAX_VAL) * 140) || 4;
              return (
                <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative", zIndex: 1 }}>
                  <div style={{ width: "60%", height: barHeight, minHeight: 4, backgroundColor: "var(--color-bar-predicted)", borderRadius: "3px 3px 0 0", transition: "height 0.5s ease" }} />
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 0, marginTop: 6 }}>
            {barsData.map((bar, idx) => (
              <div key={idx} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--color-text-muted)", fontWeight: 400 }}>
                {bar.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Recomendaciones para mañana ──────────────────────────────── */}
        <EstadoApi
          loading={isLoading}
          loadingLabel="Cargando predicciones de IA…"
          error={errorMsg || null}
          errorTitle="No se pudo obtener la sugerencia de producción"
          onRetry={() => { setIsLoading(true); void fetchPrediccion(); }}
          origen={origen}
        >
        <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 100px", columnGap: 16, padding: "10px 16px", borderBottom: "1px solid var(--color-border)" }}>
            {[
              { label: "Recomendación de producción", align: "left" },
              { label: "Cantidad sugerida", align: "right" },
              { label: "Confianza", align: "center" },
            ].map((h) => (
              <span key={h.label} style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: h.align as React.CSSProperties["textAlign"] }}>{h.label}</span>
            ))}
          </div>

          {recomendaciones.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "var(--color-text-muted)" }}>No hay predicciones generadas para este usuario. (Espera a que el cronjob corra).</div>
          ) : (
             recomendaciones.map((rec, idx) => (
            <div key={rec.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 100px", columnGap: 16, padding: "12px 16px", alignItems: "center", borderBottom: idx < recomendaciones.length - 1 ? "1px solid #F5EBDF" : "none", backgroundColor: rec.risk ? "rgba(247,227,221,0.25)" : "transparent" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {rec.risk && <span style={{ ...icon, fontSize: 13, color: "var(--color-warning-text)" }}>warning</span>}
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{rec.product}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-primary)", textAlign: "right" }}>
                {rec.qty} <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{rec.unit}</span>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 500, ...CONF_STYLE[rec.confidence] }}>{rec.confidence}</span>
              </div>
            </div>
          ))
          )}
        </div>
        </EstadoApi>

      </div>
    </AppLayout>
  );
}