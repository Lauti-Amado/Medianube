// frontend/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import KpiCard from "../../src/src/components/ui/KpiCard";
import PageHeader from "../../src/src/components/ui/PageHeader";
import Card from "../../src/src/components/ui/Card";
import Badge from "../../src/src/components/ui/Badge";
import Button from "../../src/src/components/ui/Button";
import Alert from "../../src/src/components/ui/Alert";
import Skeleton from "../../src/src/components/ui/Skeleton";
import { useNombreNegocio } from "../../lib/negocio";
import DemandChart from "../../src/src/components/dashboard/DemandChart";

// ── Shared styles ─────────────────────────────────────────────────────────

const dividerRow: React.CSSProperties = {
  borderTop: "1px solid var(--color-border-subtle)",
  paddingTop: "10px",
  marginTop: "10px",
};

const rowMeta: React.CSSProperties = { fontSize: "12px", color: "var(--color-text-secondary)", margin: 0 };

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
  { id: "p1", supplier: "Molino San Justo", amount: "$84.200", status: "procesada", statusType: "success" as const },
  { id: "p2", supplier: "Envases SRL", amount: "$31.600", status: "procesada", statusType: "success" as const },
  { id: "p3", supplier: "Lácteos La Pampa", amount: "$47.800", status: "revisar", statusType: "warning" as const },
];

const MOCK_PRICES_FROM_IA: PriceSuggestion[] = [
  { id: "pr1", product: "Medialunas Manteca", current: "$850", suggested: "$970", variation: "-14% rentabilidad", variationType: "warning", actionable: true },
  { id: "pr2", product: "Pan Francés (kg)", current: "$1.200", suggested: "$1.320", variation: "-10% rentabilidad", variationType: "warning", actionable: true },
  { id: "pr3", product: "Cañoncitos", current: "$490", suggested: "$490", variation: "estable", variationType: "neutral", actionable: false },
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
  const [nombreNegocio] = useNombreNegocio();

  // Estados de IA
  const [demandaDashboard, setDemandaDashboard] = useState<{ produccionPrevista: string; deltaProduccion: string; tendencia: "up" | "down" | "stable" } | null>(null);
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
      {/* ── 1. Encabezado ────────────────────────────────────────────────── */}
      <PageHeader
        title={nombreNegocio ? `${greeting}, ${nombreNegocio}` : greeting}
        subtitle={`${dateStr} · actualizado hace 2 minutos`}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>

        {/* ── 2. KPIs ────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "12px" }}>
          <KpiCard id="kpi-margin" label="Margen promedio" value="34,2%" loading={isLoading} trend={{ direction: "up", delta: "+2,4% vs. mes anterior", positive: true }} />
          <KpiCard id="kpi-alerts" label="Alertas de precio" value={`${alertsCount} alertas`} loading={isLoading} isAlert={showRentabilityAlert} trend={{ direction: showRentabilityAlert ? "up" : "stable", delta: "Detectado por IA de costos", positive: !showRentabilityAlert }} />
          <KpiCard id="kpi-production" label="Producción prevista" value={demandaDashboard?.produccionPrevista || "—"} loading={isLoading} trend={{ direction: demandaDashboard?.tendencia || "stable", delta: demandaDashboard?.deltaProduccion || "—", positive: false }} />
          <KpiCard id="kpi-invoices" label="Facturas del mes" value="28 / 32" trend={{ direction: "stable", delta: "3 pendientes de revisión", positive: true }} />
        </div>

        {/* ── 3. Aviso prioritario (dinámico) ────────────────────────────── */}
        {!isLoading && showRentabilityAlert && (
          <Alert
            id="dashboard-alert-banner"
            tone="warning"
            action={<Button variant="warning" size="sm" href="/precios">revisar sugerencias</Button>}
          >
            <strong>{alertsCount} productos necesitan ajuste de precio urgente</strong>
            {" — "}la IA detectó que la rentabilidad de {alertProductsText} caerá por debajo del objetivo debido a aumentos recientes en insumos.
          </Alert>
        )}

        {/* ── 4. Dos columnas ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

          {/* Compras recientes */}
          <Card
            title={<>Compras recientes <Badge>3 facturas</Badge></>}
            icon="receipt_long"
            action={<Button variant="text" size="sm" href="/compras" iconEnd="chevron_right">ver todas</Button>}
          >
            {PURCHASES.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...(i > 0 ? dividerRow : {}) }}>
                <div>
                  <p style={{ fontSize: "13px", color: "var(--color-text-primary)", margin: "0 0 2px" }}>{p.supplier}</p>
                  <p style={rowMeta}>{p.amount}</p>
                </div>
                <Badge tone={p.statusType}>{p.status}</Badge>
              </div>
            ))}
          </Card>

          {/* Precios sugeridos por IA */}
          <Card
            title={<>Precios sugeridos <Badge tone="ia">IA</Badge></>}
            icon="sell"
            action={<Button variant="text" size="sm" href="/precios" iconEnd="chevron_right">ver todos</Button>}
          >
            {isLoading ? (
              <div role="status" aria-label="Calculando precios sugeridos" style={{ display: "flex", flexDirection: "column", gap: "22px", padding: "6px 0" }}>
                <Skeleton width="70%" />
                <Skeleton width="55%" />
                <Skeleton width="62%" />
              </div>
            ) : pricesIA.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", ...(i > 0 ? dividerRow : {}) }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", color: "var(--color-text-primary)", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.product}</p>
                  <p style={rowMeta}>{p.current}<span style={{ margin: "0 4px" }}>→</span><strong style={{ color: "var(--color-text-primary)" }}>{p.suggested}</strong></p>
                </div>
                <Badge tone={p.variationType}>{p.variation}</Badge>
                {p.actionable ? (
                  <Button variant="accent" size="sm">aplicar</Button>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", whiteSpace: "nowrap", flexShrink: 0 }}>al día</span>
                )}
              </div>
            ))}
          </Card>
        </div>

        {/* ── 5. Predicción de demanda (ancho completo) ───────────────────── */}
        <Card
          title={<>Predicción de demanda <Badge tone="ia">IA</Badge></>}
          icon="trending_up"
          action={<Button variant="text" size="sm" href="/demanda" iconEnd="chevron_right">ver detalle</Button>}
        >
          <p style={{ ...rowMeta, marginBottom: "6px" }}>histórico 7 días · proyección IA próximos 7 días</p>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "0 0 14px" }}>
            Pico proyectado el sábado: <strong style={{ color: "var(--color-text-primary)" }}>+35% sobre el promedio</strong>
          </p>
          <DemandChart />
        </Card>

      </div>
    </AppLayout>
  );
}
