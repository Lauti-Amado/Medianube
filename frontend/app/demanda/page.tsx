"use client";

import { useState } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";

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

// ── Mock data ─────────────────────────────────────────────────────────────────

const BARS: DayBar[] = [
  { label: "lun", value: 320, predicted: false },
  { label: "mar", value: 290, predicted: false },
  { label: "mié", value: 410, predicted: false },
  { label: "jue", value: 380, predicted: false },
  { label: "vie", value: 520, predicted: false },
  { label: "sáb", value: 680, predicted: false },
  { label: "dom", value: 210, predicted: false },
  { label: "lun", value: 340, predicted: true  },
  { label: "mar", value: 300, predicted: true  },
  { label: "mié", value: 430, predicted: true  },
  { label: "jue", value: 400, predicted: true  },
  { label: "vie", value: 590, predicted: true  },
  { label: "sáb", value: 720, predicted: true  },
  { label: "dom", value: 190, predicted: true  },
];

const RECS: Recommendation[] = [
  { id: "r1", product: "Medialunas de manteca", qty: 240, unit: "u.", confidence: "alta"  },
  { id: "r2", product: "Pan francés",           qty: 18,  unit: "kg", confidence: "alta"  },
  { id: "r3", product: "Café con leche",        qty: 95,  unit: "u.", confidence: "media" },
  { id: "r4", product: "Torta de chocolate",    qty: 6,   unit: "porciones", confidence: "baja", risk: true },
  { id: "r5", product: "Alfajor de maicena",    qty: 80,  unit: "u.", confidence: "alta"  },
  { id: "r6", product: "Croissant jamón/queso", qty: 60,  unit: "u.", confidence: "media" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_VAL = Math.max(...BARS.map((b) => b.value));

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

  const handleRecalculate = () => {
    setRecalculating(true);
    setTimeout(() => setRecalculating(false), 1500);
  };

  const atRisk = RECS.filter((r) => r.risk).length;

  return (
    <AppLayout activeTab="demanda">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              Predicción de demanda
            </h1>
            <p
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                margin: "4px 0 0",
              }}
            >
              Proyección para los próximos 7 días · basada en historial de ventas
            </p>
          </div>

          <button
            id="btn-recalcular-demanda"
            onClick={handleRecalculate}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: "var(--color-accent)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              padding: "9px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              opacity: recalculating ? 0.7 : 1,
              transition: "opacity 0.2s",
            }}
          >
            <span
              style={{
                ...icon,
                fontSize: 15,
                animation: recalculating ? "spin 1s linear infinite" : "none",
              }}
            >
              autorenew
            </span>
            {recalculating ? "Calculando…" : "Recalcular con IA"}
          </button>
        </div>

        {/* ── KPIs ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            {
              label: "Producción total prevista",
              value: "2.970 u.",
              sub: "para los próximos 7 días",
              warn: false,
            },
            {
              label: "Precisión del modelo",
              value: "91.4%",
              sub: "sobre las últimas 4 semanas",
              warn: false,
            },
            {
              label: "Productos en riesgo de faltante",
              value: String(atRisk),
              sub: "con baja confianza de predicción",
              warn: true,
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                {kpi.label}
              </span>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: kpi.warn
                    ? "var(--color-warning-text)"
                    : "var(--color-text-primary)",
                  marginBottom: 4,
                }}
              >
                {kpi.value}
              </div>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                {kpi.sub}
              </span>
            </div>
          ))}
        </div>

        {/* ── Gráfico de barras ─────────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            padding: "20px 24px",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text-primary)",
              }}
            >
              Producción diaria — histórico vs. predicción
            </span>
            {/* Leyenda */}
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: "var(--color-bar-historic)",
                  }}
                />
                <span
                  style={{ fontSize: 11, color: "var(--color-text-secondary)" }}
                >
                  Histórico
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: "var(--color-bar-predicted)",
                  }}
                />
                <span
                  style={{ fontSize: 11, color: "var(--color-text-secondary)" }}
                >
                  Predicción
                </span>
              </div>
            </div>
          </div>

          {/* Barras */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 0,
              height: 140,
              position: "relative",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {/* Líneas de referencia horizontales */}
            {[25, 50, 75].map((pct) => (
              <div
                key={pct}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: `${pct}%`,
                  borderTop: "1px dashed #F0E4D4",
                  zIndex: 0,
                }}
              />
            ))}

            {BARS.map((bar, idx) => {
              const isToday = idx === 6;
              const barHeight = Math.round((bar.value / MAX_VAL) * 140);
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    height: "100%",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {/* Divisor "hoy" */}
                  {isToday && (
                    <div
                      style={{
                        position: "absolute",
                        right: -1,
                        top: -8,
                        bottom: -24,
                        width: 1,
                        borderRight: "1px dashed var(--color-border-strong)",
                        zIndex: 2,
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: "60%",
                      height: barHeight,
                      minHeight: 4,
                      backgroundColor: bar.predicted
                        ? "var(--color-bar-predicted)"
                        : "var(--color-bar-historic)",
                      borderRadius: "3px 3px 0 0",
                      transition: "height 0.5s ease",
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Labels eje X */}
          <div
            style={{
              display: "flex",
              gap: 0,
              marginTop: 6,
            }}
          >
            {BARS.map((bar, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 10,
                  color:
                    idx === 6
                      ? "var(--color-accent)"
                      : "var(--color-text-muted)",
                  fontWeight: idx === 6 ? 500 : 400,
                }}
              >
                {bar.label}
                {idx === 6 && (
                  <div style={{ fontSize: 9, color: "var(--color-accent)" }}>
                    hoy
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Recomendaciones para mañana ──────────────────────────────── */}
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
          }}
        >
          {/* Header tabla */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 100px",
              columnGap: 16,
              padding: "10px 16px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {[
              { label: "Recomendación de producción para mañana", align: "left" },
              { label: "Cantidad sugerida", align: "right" },
              { label: "Confianza", align: "center" },
            ].map((h) => (
              <span
                key={h.label}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  textAlign: h.align as React.CSSProperties["textAlign"],
                }}
              >
                {h.label}
              </span>
            ))}
          </div>

          {/* Filas */}
          {RECS.map((rec, idx) => (
            <div
              key={rec.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 100px",
                columnGap: 16,
                padding: "12px 16px",
                alignItems: "center",
                borderBottom:
                  idx < RECS.length - 1 ? "1px solid #F5EBDF" : "none",
                backgroundColor: rec.risk
                  ? "rgba(247,227,221,0.25)"
                  : "transparent",
              }}
            >
              {/* Producto */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {rec.risk && (
                  <span
                    style={{
                      ...icon,
                      fontSize: 13,
                      color: "var(--color-warning-text)",
                    }}
                  >
                    warning
                  </span>
                )}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {rec.product}
                </span>
              </div>

              {/* Cantidad */}
              <div
                style={{
                  fontSize: 13,
                  color: "var(--color-text-primary)",
                  textAlign: "right",
                }}
              >
                {rec.qty}{" "}
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {rec.unit}
                </span>
              </div>

              {/* Confianza */}
              <div style={{ textAlign: "center" }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontWeight: 500,
                    ...CONF_STYLE[rec.confidence],
                  }}
                >
                  {rec.confidence}
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </AppLayout>
  );
}