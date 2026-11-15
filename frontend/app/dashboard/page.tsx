// frontend/app/dashboard/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import KpiCard from "../../src/src/components/ui/KpiCard";
import PageHeader from "../../src/src/components/ui/PageHeader";
import Card from "../../src/src/components/ui/Card";
import Badge, { type BadgeTone } from "../../src/src/components/ui/Badge";
import Button from "../../src/src/components/ui/Button";
import Alert from "../../src/src/components/ui/Alert";
import Icon from "../../src/src/components/ui/Icon";
import Skeleton from "../../src/src/components/ui/Skeleton";
import DemandChart, { DemandLegend, type DemandDay } from "../../src/src/components/dashboard/DemandChart";
import { useNombreNegocio } from "../../lib/negocio";
import { formatMoneda } from "../../lib/formato";

// ── Shared styles ─────────────────────────────────────────────────────────

const row: React.CSSProperties = {
  display: "grid",
  alignItems: "center",
  columnGap: "12px",
  padding: "10px 0",
};

const rowDivider: React.CSSProperties = { borderTop: "1px solid var(--color-border-subtle)" };

const rowTitle: React.CSSProperties = { fontSize: "13px", color: "var(--color-text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const rowMeta: React.CSSProperties = { fontSize: "12px", lineHeight: "16px", color: "var(--color-text-secondary)", margin: "2px 0 0" };

// ── Types & Data Mocks ───────────────────────────────────────────────────
// MOCK TEMPORAL: el dashboard todavía no lee los endpoints de Compras, Precios y Demanda.
// Los números están alineados entre sí y con los mockups del plan (3 facturas por revisar,
// 2 precios a revisar, 315 u. para mañana). Las fechas se calculan a partir de hoy.

type PurchaseStatus = "procesada" | "revisar" | "procesando";

interface Purchase {
  id: string;
  supplier: string;
  amount: number;
  /** Días hacia atrás desde hoy. */
  daysAgo: number;
  status: PurchaseStatus;
}

interface PriceSuggestion {
  id: string;
  product: string;
  current: number;
  suggested: number;
  /** Margen con el precio actual, en %. */
  margin: number;
  /** Margen objetivo de la categoría, en %. */
  targetMargin: number;
}

const PURCHASES: Purchase[] = [
  { id: "p1", supplier: "Distribuidora Sur S.A.", amount: 135123, daysAgo: 0, status: "procesando" },
  { id: "p2", supplier: "Molino San Justo", amount: 84200, daysAgo: 1, status: "procesada" },
  { id: "p3", supplier: "Envases SRL", amount: 31600, daysAgo: 2, status: "procesada" },
  { id: "p4", supplier: "Lácteos La Pampa", amount: 47800, daysAgo: 3, status: "revisar" },
];

const MOCK_PRICES_FROM_IA: PriceSuggestion[] = [
  { id: "pr1", product: "Medialunas de manteca", current: 850, suggested: 970, margin: 32, targetMargin: 40 },
  { id: "pr2", product: "Pan francés (kg)", current: 1200, suggested: 1320, margin: 34, targetMargin: 40 },
  { id: "pr3", product: "Cañoncitos", current: 490, suggested: 490, margin: 42, targetMargin: 40 },
];

// Unidades por día de la semana (índice 0 = domingo): el sábado es el pico, el domingo el piso.
const MOCK_DEMAND_BY_WEEKDAY = {
  historic: [118, 186, 172, 228, 214, 262, 296],
  predicted: [130, 200, 190, 250, 240, 308, 315],
};

const INVOICES_TO_REVIEW = 3;
const INVOICES_THIS_MONTH = 32;

const STATUS_TONE: Record<PurchaseStatus, BadgeTone> = { procesada: "success", revisar: "warning", procesando: "neutral" };

// ── Helpers ───────────────────────────────────────────────────────────────

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_CORTOS = ["do", "lu", "ma", "mi", "ju", "vi", "sá"];

function getGreeting(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");
const fechaCorta = (d: Date) => `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}`;
const hora = (d: Date) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;

/** "medialunas de manteca y pan francés (kg)" / "a, b y c" */
function listar(nombres: string[]) {
  const n = nombres.map((s) => s.charAt(0).toLowerCase() + s.slice(1));
  if (n.length <= 1) return n[0] ?? "";
  return `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`;
}

/** Últimos 7 días (el último es hoy) y próximos 7 (el primero es mañana). */
function buildDemandDays(hoy: Date): DemandDay[] {
  const { historic, predicted } = MOCK_DEMAND_BY_WEEKDAY;
  const etiqueta = (d: Date) => `${DIAS_CORTOS[d.getDay()]} ${d.getDate()}`;
  const dias: DemandDay[] = [];
  for (let offset = -6; offset <= 7; offset++) {
    const d = addDays(hoy, offset);
    const esPrediccion = offset > 0;
    dias.push({
      label: etiqueta(d),
      value: (esPrediccion ? predicted : historic)[d.getDay()],
      predicted: esPrediccion,
      isToday: offset === 0,
    });
  }
  return dias;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [nombreNegocio] = useNombreNegocio();

  // La fecha se resuelve en el cliente: evita diferencias con el render del servidor
  const [hoy, setHoy] = useState<Date | null>(null);
  const [actualizado, setActualizado] = useState<Date | null>(null);

  const [prices, setPrices] = useState<PriceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setHoy(new Date());

    async function fetchData() {
      try {
        // MOCK TEMPORAL: simula la respuesta combinada de los endpoints de Demanda y Precios IA
        await new Promise((resolve) => setTimeout(resolve, 800));
        setPrices(MOCK_PRICES_FROM_IA);
        setActualizado(new Date());
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // ── Datos derivados ──────────────────────────────────────────────────────
  const needsReview = prices.filter((p) => p.suggested !== p.current);

  const manana = hoy ? addDays(hoy, 1) : null;
  const demandDays = hoy ? buildDemandDays(hoy) : [];
  const predicted = demandDays.filter((d) => d.predicted).map((d) => d.value);
  const produccionManana = predicted[0] ?? 0;
  const pico = Math.max(...predicted, 0);
  const promedio = predicted.length ? predicted.reduce((a, b) => a + b, 0) / predicted.length : 1;
  const diaPico = hoy && predicted.length ? addDays(hoy, predicted.indexOf(pico) + 1) : null;
  const sobrePromedio = Math.round((pico / promedio - 1) * 100);

  const subtitle = hoy
    ? `${DIAS[hoy.getDay()]} ${hoy.getDate()} de ${hoy.toLocaleDateString("es-AR", { month: "long" })}${actualizado ? ` · actualizado ${hora(actualizado)}` : ""}`
    : " ";

  return (
    <AppLayout activeTab="dashboard">
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* ── 1. Encabezado ──────────────────────────────────────────────── */}
        <PageHeader
          title={hoy ? (nombreNegocio ? `${getGreeting(hoy)}, ${nombreNegocio}` : getGreeting(hoy)) : " "}
          subtitle={subtitle}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* ── 2. KPIs: margen, producción de mañana y facturas por revisar ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            <KpiCard
              id="kpi-margin"
              label="Margen promedio"
              value="34,2%"
              loading={isLoading}
              trend={{ direction: "up", delta: "+2,4 pts vs. el mes anterior", positive: true }}
            />
            <KpiCard
              id="kpi-production"
              label="Producción prevista para mañana"
              ia
              value={
                <>
                  {produccionManana}
                  <small>unidades</small>
                </>
              }
              loading={isLoading}
              footer={
                manana &&
                `${DIAS[manana.getDay()]} ${fechaCorta(manana)}${produccionManana === pico ? " · pico de la semana" : ""}`
              }
            />
            <KpiCard
              id="kpi-invoices"
              label="Facturas por revisar"
              href="/compras?estado=revisar"
              isAlert={INVOICES_TO_REVIEW > 0}
              value={
                <>
                  {INVOICES_TO_REVIEW}
                  <small>de {INVOICES_THIS_MONTH} este mes</small>
                </>
              }
              footer={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 500, color: "var(--color-accent-dark)" }}>
                  ver facturas
                  <Icon name="chevron_right" size={14} />
                </span>
              }
            />
          </div>

          {/* ── 3. Aviso prioritario ───────────────────────────────────────── */}
          {!isLoading && needsReview.length > 0 && (
            <Alert
              id="dashboard-alert-banner"
              tone="warning"
              action={
                <Button variant="warning" size="sm" href="/precios">
                  revisar precios
                </Button>
              }
            >
              <strong>
                {needsReview.length === 1
                  ? "1 producto queda por debajo de tu margen objetivo:"
                  : `${needsReview.length} productos quedan por debajo de tu margen objetivo:`}
              </strong>{" "}
              {listar(needsReview.map((p) => p.product))}. Subieron sus insumos.
            </Alert>
          )}

          {/* ── 4. Dos columnas ─────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" }}>
            {/* Compras recientes */}
            <Card
              title="Compras recientes"
              icon="receipt_long"
              action={
                <Button variant="text" size="sm" href="/compras" iconEnd="chevron_right">
                  ver todas
                </Button>
              }
            >
              <div style={{ margin: "-10px 0" }}>
                {PURCHASES.map((p, i) => (
                  <div key={p.id} style={{ ...row, gridTemplateColumns: "1fr auto 96px", ...(i > 0 ? rowDivider : {}) }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={rowTitle}>{p.supplier}</p>
                      <p style={rowMeta}>{hoy ? fechaCorta(addDays(hoy, -p.daysAgo)) : " "}</p>
                    </div>
                    <span className="num" style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                      {formatMoneda(p.amount)}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      {p.status === "revisar" ? (
                        <Link href="/compras?estado=revisar" aria-label={`revisar la factura de ${p.supplier}`} style={{ textDecoration: "none" }}>
                          <Badge tone="warning">
                            revisar
                            <Icon name="chevron_right" size={12} />
                          </Badge>
                        </Link>
                      ) : (
                        <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Precios sugeridos por IA */}
            <Card
              title={
                <>
                  Precios sugeridos <Badge tone="ia">IA</Badge>
                </>
              }
              icon="sell"
              action={
                <Button variant="text" size="sm" href="/precios" iconEnd="chevron_right">
                  ver todos
                </Button>
              }
            >
              {isLoading ? (
                <div role="status" aria-label="Calculando precios sugeridos" style={{ display: "flex", flexDirection: "column", gap: "26px", padding: "8px 0" }}>
                  <Skeleton width="70%" />
                  <Skeleton width="55%" />
                  <Skeleton width="62%" />
                </div>
              ) : (
                <div style={{ margin: "-10px 0" }}>
                  {prices.map((p, i) => {
                    const stable = p.suggested === p.current;
                    const belowTarget = p.margin < p.targetMargin;

                    return (
                      <div key={p.id} style={{ ...row, gridTemplateColumns: "1fr auto 72px", ...(i > 0 ? rowDivider : {}) }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={rowTitle}>{p.product}</p>
                          <p style={rowMeta}>
                            {formatMoneda(p.current)}
                            {!stable && (
                              <>
                                <span style={{ margin: "0 4px" }}>→</span>
                                <strong style={{ color: "var(--color-text-primary)" }}>{formatMoneda(p.suggested)}</strong>
                              </>
                            )}
                          </p>
                        </div>
                        {belowTarget ? (
                          <Badge tone="warning">
                            margen {p.margin}% · obj. {p.targetMargin}%
                          </Badge>
                        ) : (
                          <Badge>estable</Badge>
                        )}
                        {/* Aplicar un precio se hace en Precios, donde están las sugerencias reales.
                            Acá los datos todavía son de ejemplo: el botón lleva, no aplica. */}
                        <span style={{ textAlign: "right" }}>
                          {stable ? (
                            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>al día</span>
                          ) : (
                            <Button variant="accent" size="sm" href="/precios" aria-label={`revisar el precio de ${p.product.toLowerCase()}`}>
                              revisar
                            </Button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ── 5. Predicción de demanda, compacta ──────────────────────────── */}
          <Card
            title={
              <>
                Predicción de demanda <Badge tone="ia">IA</Badge>
              </>
            }
            icon="trending_up"
            action={
              <Button variant="text" size="sm" href="/demanda" iconEnd="chevron_right">
                ver detalle
              </Button>
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "14px" }}>
              <p style={{ fontSize: "13px", color: "var(--color-text-primary)", margin: 0 }}>
                {diaPico && (
                  <>
                    El {DIAS[diaPico.getDay()]} se espera el pico de la semana: <strong>+{sobrePromedio}% sobre el promedio</strong>.
                  </>
                )}
              </p>
              <DemandLegend />
            </div>
            {hoy ? <DemandChart days={demandDays} /> : <div style={{ height: 172 }} />}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
