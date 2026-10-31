// frontend/app/dashboard/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import KpiCard from "../../src/src/components/dashboard/KpiCard";
import DemandChart from "../../src/src/components/dashboard/DemandChart";

// ── Shared styles ─────────────────────────────────────────────────────────

const iconStyle: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "16px",
  lineHeight: 1,
  userSelect: "none",
};

const sectionCard: React.CSSProperties = {
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  padding: "16px",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "12px",
};

const sectionTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  fontSize: "12px",
  fontWeight: 700,
  color: "var(--color-text-primary)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  margin: 0,
  paddingLeft: "8px",
  borderLeft: "2px solid var(--color-accent)",
};

const badge = (bg: string, text: string): React.CSSProperties => ({
  backgroundColor: bg,
  color: text,
  fontSize: "11px",
  fontWeight: 500,
  padding: "2px 7px",
  borderRadius: "var(--radius-full)",
});

const viewAllLink: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-accent)",
  textDecoration: "none",
  fontWeight: 500,
};

const dividerRow: React.CSSProperties = {
  borderTop: "1px solid var(--color-border-subtle)",
  paddingTop: "10px",
  marginTop: "10px",
};

// ── Types & Data Mocks ───────────────────────────────────────────────────

interface PriceSuggestion {
  id: string;
  product: string;
  current: string;
  suggested: string;
  variation: string;
  variationType: "warning" | "neutral" | "success";
  actionable: boolean;
}

const PURCHASES = [
  { id: "p1", supplier: "Molino San Justo", amount: "$84.200", status: "Procesada", statusType: "success" as const },
  { id: "p2", supplier: "Envases SRL", amount: "$31.600", status: "Procesada", statusType: "success" as const },
  { id: "p3", supplier: "Lácteos La Pampa", amount: "$47.800", status: "Revisar", statusType: "warning" as const },
];

const MOCK_PRICES_FROM_IA: PriceSuggestion[] = [
  { id: "pr1", product: "Medialunas Manteca", current: "$850", suggested: "$970", variation: "-14% rentabilidad", variationType: "warning", actionable: true },
  { id: "pr2", product: "Pan Francés (kg)", current: "$1.200", suggested: "$1.320", variation: "-10% rentabilidad", variationType: "warning", actionable: true },
  { id: "pr3", product: "Cañoncitos", current: "$490", suggested: "$490", variation: "Estable", variationType: "neutral", actionable: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatDate() {
  return new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [greeting, setGreeting] = useState("");
  const [dateStr, setDateStr] = useState("");

  // Estados de IA
  const [demandaDashboard, setDemandaDashboard] = useState<any>(null);
  const [pricesIA, setPricesIA] = useState<PriceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setGreeting(getGreeting());
    setDateStr(formatDate());

    async function fetchData() {
        try {
            // MOCK TEMPORAL: Simulamos la respuesta combinada de los endpoints de Demanda y Precios IA
            await new Promise(resolve => setTimeout(resolve, 800));
            setDemandaDashboard({
                produccionPrevista: "2.180 u.",
                deltaProduccion: "−180 vs. estimación previa",
                tendencia: "down"
            });
            setPricesIA(MOCK_PRICES_FROM_IA);
        } catch(error){
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }
    fetchData();
  }, []);

  // Lógica Dinámica para la Notificación (Semana 4)
  const alertsCount = pricesIA.filter(p => p.variationType === "warning").length;
  const showRentabilityAlert = alertsCount > 0;
  const alertProductsText = pricesIA.filter(p => p.variationType === "warning").map(p => p.product).join(" y ");

  return (
    <AppLayout activeTab="dashboard">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>

        {/* ── 1. Page Header ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#2C1A0E", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
              {greeting}, Panadería La Espiga
            </h1>
            <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: 0 }}>
              <span style={{ ...iconStyle, fontSize: "12px", verticalAlign: "middle", color: "var(--color-accent)", marginRight: "4px" }}>
                auto_awesome
              </span>
              {dateStr} · actualizado hace 2 minutos
            </p>
          </div>
          <Link href="/compras/subir" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary)", textDecoration: "none", backgroundColor: "var(--color-surface)" }}>
            <span style={iconStyle}>upload_file</span>
            subir factura
          </Link>
        </div>

        {/* ── 2. KPI Row ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "12px" }}>
          <KpiCard id="kpi-margin" label="margen promedio" value={isLoading ? "..." : "34.2%"} trend={{ direction: "up", delta: "+2.4% vs. mes anterior", positive: true }} />
          <KpiCard id="kpi-alerts" label="alertas de precio" value={isLoading ? "..." : `${alertsCount} alertas`} isAlert={showRentabilityAlert} trend={{ direction: showRentabilityAlert ? "up" : "stable", delta: "Detectado por IA de costos", positive: !showRentabilityAlert }} />
          <KpiCard id="kpi-production" label="producción prevista" value={isLoading ? "..." : demandaDashboard?.produccionPrevista || "-"} trend={{ direction: isLoading ? "stable" : demandaDashboard?.tendencia || "stable", delta: isLoading ? "Cargando..." : demandaDashboard?.deltaProduccion || "-", positive: false }} />
          <KpiCard id="kpi-invoices" label="facturas del mes" value="28 / 32" trend={{ direction: "stable", delta: "4 pendientes de revisión", positive: true }} />
        </div>

        {/* ── 3. Priority Alert Banner (Dinámico) ────────────────────────── */}
        {!isLoading && showRentabilityAlert && (
          <div
            id="dashboard-alert-banner"
            style={{
              display: "flex", alignItems: "center", gap: "12px", backgroundColor: "var(--color-warning-bg)", borderRadius: "var(--radius-md)", borderLeft: "3px solid var(--color-warning-text)", padding: "12px 16px"
            }}
          >
            <span style={{ ...iconStyle, color: "var(--color-warning-text)", flexShrink: 0 }}>warning</span>
            <p style={{ fontSize: "12px", color: "var(--color-warning-text)", margin: 0, flex: 1, lineHeight: "1.5" }}>
              <strong style={{ fontWeight: 500 }}>{alertsCount} productos necesitan ajuste de precio urgente</strong>
              {" — "}la IA detectó que la rentabilidad de {alertProductsText} caerá por debajo del objetivo debido a aumentos recientes en insumos.
            </p>
            <Link href="/precios" style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-warning-text)", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
              revisar sugerencias →
            </Link>
          </div>
        )}

        {/* ── 4. Two-Column Grid ──────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

          {/* Compras Recientes */}
          <div style={sectionCard}>
            <div style={sectionHeader}>
              <p style={sectionTitle}><span style={{ ...iconStyle, color: "var(--color-text-secondary)" }}>receipt_long</span>compras recientes<span style={badge("var(--color-neutral-bg)", "var(--color-neutral-text)")}>3 facturas</span></p>
              <Link href="/compras" style={viewAllLink}>ver todas →</Link>
            </div>
            {PURCHASES.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...(i > 0 ? dividerRow : {}) }}>
                <div>
                  <p style={{ fontSize: "13px", color: "var(--color-text-primary)", margin: "0 0 2px", fontWeight: 400 }}>{p.supplier}</p>
                  <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>{p.amount}</p>
                </div>
                <span style={badge(p.statusType === "success" ? "var(--color-success-bg)" : "var(--color-warning-bg)", p.statusType === "success" ? "var(--color-success-text)" : "var(--color-warning-text)")}>{p.status}</span>
              </div>
            ))}
          </div>

          {/* Precios Sugeridos por IA */}
          <div style={sectionCard}>
            <div style={sectionHeader}>
              <p style={sectionTitle}><span style={{ ...iconStyle, color: "var(--color-accent)", fontSize: "14px" }}>auto_awesome</span>precios sugeridos<span style={badge("var(--color-accent-tint)", "var(--color-accent-dark)")}>IA</span></p>
              <Link href="/precios" style={viewAllLink}>ver todos →</Link>
            </div>
            {isLoading ? (
              <p style={{ fontSize: "12px", color: "var(--color-text-muted)", textAlign: "center", padding: "20px 0" }}>Analizando costos y rentabilidad...</p>
            ) : pricesIA.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", ...(i > 0 ? dividerRow : {}) }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", color: "var(--color-text-primary)", margin: "0 0 2px", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.product}</p>
                  <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>{p.current}<span style={{ margin: "0 4px" }}>→</span><strong style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{p.suggested}</strong></p>
                </div>
                <span style={badge(p.variationType === "warning" ? "var(--color-warning-bg)" : "var(--color-neutral-bg)", p.variationType === "warning" ? "var(--color-warning-text)" : "var(--color-neutral-text)")}>{p.variation}</span>
                {p.actionable ? (
                  <button type="button" style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 500, backgroundColor: "var(--color-accent)", color: "var(--color-on-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Aplicar</button>
                ) : (
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>Al día</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. Demand Forecast Panel (full-width) ───────────────────────── */}
        <div style={sectionCard}>
          <div style={{ ...sectionHeader, marginBottom: "4px" }}>
            <p style={sectionTitle}><span style={{ ...iconStyle, color: "var(--color-text-secondary)" }}>trending_up</span>predicción de demanda<span style={{ ...badge("var(--color-neutral-bg)", "var(--color-neutral-text)"), fontWeight: 400, fontSize: "10px" }}>modelo v2.4</span></p>
            <Link href="/demanda" style={viewAllLink}>ver detalle →</Link>
          </div>
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: "0 0 14px" }}>histórico 7 días · proyección IA próximos 7 días</p>
          <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: "0 0 14px", display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ ...iconStyle, fontSize: "13px", color: "var(--color-accent)" }}>auto_awesome</span>Pico proyectado el sábado <strong style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>+35% sobre el promedio</strong>{" — "}<Link href="/demanda" style={{ color: "var(--color-accent)", fontWeight: 500, textDecoration: "none" }}>ver recomendación →</Link>
          </p>
          <DemandChart />
        </div>

      </div>
    </AppLayout>
  );
}