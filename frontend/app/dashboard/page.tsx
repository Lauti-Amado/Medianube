// frontend/app/dashboard/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import KpiCard from "../../src/src/components/ui/KpiCard";
import PageHeader from "../../src/src/components/ui/PageHeader";
import Card from "../../src/src/components/ui/Card";
import Badge, { type BadgeTone } from "../../src/src/components/ui/Badge";
import Button from "../../src/src/components/ui/Button";
import Icon from "../../src/src/components/ui/Icon";
import Skeleton, { SkeletonRows } from "../../src/src/components/ui/Skeleton";
import DemandChart, { DemandLegend, type DemandDay } from "../../src/src/components/dashboard/DemandChart";
import { useNombreNegocio } from "../../lib/negocio";
import { formatMoneda } from "../../lib/formato";
import { COMPRAS_URL, calcularResumen, leerGastos, mapInvoices, recientes, type Invoice, type InvoiceStatus, type Resumen } from "../../lib/compras";
import { DEMANDA_URL, agruparPorDia, isoLocal, resumenSemana, type DemandaApiResponse, type DiaDemanda } from "../../lib/demanda";

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

/** Bloque sin datos o con error: un texto corto y una acción. */
const estadoBloque: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "4px 0" };

const textoEstado: React.CSSProperties = { fontSize: "13px", lineHeight: "20px", color: "var(--color-text-secondary)", margin: 0 };

// ── Types ─────────────────────────────────────────────────────────────────
// Los datos salen de GET /compras y GET /demanda, con las mismas funciones que usan esas pantallas
// (lib/compras y lib/demanda), así los números coinciden. Precios no tiene todavía una lectura sin
// llamar a la IA (tarea 6a): hasta entonces su bloque solo lleva a la pantalla de Precios.

interface EstadoCompras {
  invoices: Invoice[];
  resumen: Resumen | null;
  loading: boolean;
  error: boolean;
}

interface EstadoDemanda {
  dias: DiaDemanda[];
  loading: boolean;
  error: boolean;
}

const STATUS_TONE: Record<InvoiceStatus, BadgeTone> = { procesada: "success", revisar: "warning", procesando: "neutral" };

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

/** "2026-11-10" → "10/11". Sin fecha ISO, "sin fecha". */
function fechaCortaIso(iso: string) {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[2]}/${m[1]}` : "sin fecha";
}

/** Mediodía local: evita que el cambio de zona horaria corra la fecha un día. */
const aFecha = (iso: string) => new Date(`${iso}T12:00:00`);

// ── Page ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [nombreNegocio] = useNombreNegocio();

  // La fecha se resuelve en el cliente: evita diferencias con el render del servidor
  const [hoy, setHoy] = useState<Date | null>(null);
  const [actualizado, setActualizado] = useState<Date | null>(null);

  // Cada bloque carga por su cuenta: si un endpoint falla, el resto del dashboard sigue
  const [compras, setCompras] = useState<EstadoCompras>({ invoices: [], resumen: null, loading: true, error: false });
  const [demanda, setDemanda] = useState<EstadoDemanda>({ dias: [], loading: true, error: false });

  const cargarCompras = useCallback(async () => {
    setCompras((c) => ({ ...c, loading: true, error: false }));
    try {
      const response = await fetch(COMPRAS_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const invoices = mapInvoices(leerGastos(await response.json()));
      setCompras({ invoices, resumen: calcularResumen(invoices, new Date()), loading: false, error: false });
      setActualizado(new Date());
    } catch (error) {
      console.error("Error al cargar las compras:", error);
      setCompras({ invoices: [], resumen: null, loading: false, error: true });
    }
  }, []);

  const cargarDemanda = useCallback(async () => {
    setDemanda((d) => ({ ...d, loading: true, error: false }));
    try {
      const response = await fetch(DEMANDA_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as DemandaApiResponse;
      setDemanda({ dias: agruparPorDia(data.produccion ?? []), loading: false, error: false });
      setActualizado(new Date());
    } catch (error) {
      console.error("Error al cargar la predicción:", error);
      setDemanda({ dias: [], loading: false, error: true });
    }
  }, []);

  useEffect(() => {
    setHoy(new Date());
    void Promise.all([cargarCompras(), cargarDemanda()]);
  }, [cargarCompras, cargarDemanda]);

  // ── Datos derivados ──────────────────────────────────────────────────────
  const { resumen } = compras;
  const ultimasCompras = recientes(compras.invoices, 4);

  const manana = hoy ? addDays(hoy, 1) : null;
  const mananaIso = manana ? isoLocal(manana) : null;
  const semana = resumenSemana(demanda.dias);
  const produccionManana = demanda.dias.find((d) => d.fecha === mananaIso)?.total ?? null;
  const esPicoManana = produccionManana !== null && semana.pico?.fecha === mananaIso;
  const hayPrediccion = !demanda.error && demanda.dias.length > 0;

  const demandDays: DemandDay[] = demanda.dias.map((d) => {
    const fecha = aFecha(d.fecha);
    return { label: `${DIAS_CORTOS[fecha.getDay()]} ${fecha.getDate()}`, value: d.total, predicted: true };
  });
  const diaPico = semana.pico ? aFecha(semana.pico.fecha) : null;

  const subtitle = hoy
    ? `${DIAS[hoy.getDay()]} ${hoy.getDate()} de ${hoy.toLocaleDateString("es-AR", { month: "long" })}${actualizado ? ` · actualizado ${hora(actualizado)}` : ""}`
    : " ";

  return (
    <AppLayout activeTab="dashboard">
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* ── 1. Encabezado ──────────────────────────────────────────────── */}
        <PageHeader
          title={hoy ? (nombreNegocio ? `${getGreeting(hoy)}, ${nombreNegocio}` : getGreeting(hoy)) : " "}
          subtitle={subtitle}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* ── 2. KPIs: margen, producción de mañana y facturas por revisar ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            {/* El margen sale de las sugerencias de Precios, que todavía no se pueden leer sin llamar a la IA */}
            <KpiCard id="kpi-margin" label="Margen promedio" value="—" footer="aparece cuando Precios guarde sugerencias" />
            <KpiCard
              id="kpi-production"
              label="Producción prevista para mañana"
              ia
              value={
                produccionManana !== null ? (
                  <>
                    {produccionManana.toLocaleString("es-AR")}
                    <small>unidades</small>
                  </>
                ) : (
                  "—"
                )
              }
              loading={demanda.loading}
              footer={
                manana &&
                (produccionManana !== null
                  ? `${DIAS[manana.getDay()]} ${fechaCorta(manana)}${esPicoManana ? " · pico de la semana" : ""}`
                  : "sin predicción para mañana")
              }
            />
            <KpiCard
              id="kpi-invoices"
              label="Facturas por revisar"
              href="/compras?estado=revisar"
              isAlert={(resumen?.porRevisar ?? 0) > 0}
              loading={compras.loading}
              value={
                resumen ? (
                  <>
                    {resumen.porRevisar}
                    <small>de {resumen.facturasMes} este mes</small>
                  </>
                ) : (
                  "—"
                )
              }
              footer={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 500, color: "var(--color-accent-dark)" }}>
                  ver facturas
                  <Icon name="chevron_right" size={14} />
                </span>
              }
            />
          </div>

          {/* ── 3. Dos columnas ─────────────────────────────────────────────── */}
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
              {compras.loading ? (
                <SkeletonRows rows={4} label="Cargando tus compras" />
              ) : compras.error ? (
                <div style={estadoBloque}>
                  <p style={textoEstado}>No pudimos cargar tus compras.</p>
                  <Button variant="warning" size="sm" icon="refresh" onClick={() => void cargarCompras()}>
                    reintentar
                  </Button>
                </div>
              ) : ultimasCompras.length === 0 ? (
                <div style={estadoBloque}>
                  <p style={textoEstado}>Todavía no cargaste facturas.</p>
                  <Button variant="text" size="sm" href="/compras/subir">
                    subir factura
                  </Button>
                </div>
              ) : (
                <div style={{ margin: "-10px 0" }}>
                  {ultimasCompras.map((p, i) => (
                    <div key={p.id} style={{ ...row, gridTemplateColumns: "1fr auto 96px", ...(i > 0 ? rowDivider : {}) }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={rowTitle}>{p.provider}</p>
                        <p style={rowMeta}>{fechaCortaIso(p.date)}</p>
                      </div>
                      <span className="num" style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                        {formatMoneda(p.total)}
                      </span>
                      <span style={{ textAlign: "right" }}>
                        {p.status === "revisar" ? (
                          <Link href="/compras?estado=revisar" aria-label={`revisar la factura de ${p.provider}`} style={{ textDecoration: "none" }}>
                            <Badge tone="warning">
                              revisar
                              <Icon name="chevron_right" size={12} />
                            </Badge>
                          </Link>
                        ) : (
                          <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Precios sugeridos por IA: sin lectura disponible todavía, el bloque solo lleva a Precios */}
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
              <div style={estadoBloque}>
                <p style={textoEstado}>Las sugerencias se generan en Precios a partir de tus costos.</p>
                <Button variant="secondary" size="sm" href="/precios">
                  ver precios
                </Button>
              </div>
            </Card>
          </div>

          {/* ── 4. Predicción de demanda, compacta ──────────────────────────── */}
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
            {demanda.loading ? (
              <div role="status" aria-label="Cargando la predicción">
                <Skeleton height={172} />
              </div>
            ) : !hayPrediccion ? (
              <div style={estadoBloque}>
                <p style={textoEstado}>Todavía no hay predicción.</p>
                <Button variant="text" size="sm" href="/demanda">
                  ver demanda
                </Button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "14px" }}>
                  <p style={{ fontSize: "13px", color: "var(--color-text-primary)", margin: 0 }}>
                    {diaPico && semana.promedio > 0 && (
                      <>
                        El {DIAS[diaPico.getDay()]} se espera el pico de la semana: <strong>+{semana.picoPct}% sobre el promedio</strong>.
                      </>
                    )}
                  </p>
                  <DemandLegend />
                </div>
                <DemandChart days={demandDays} />
              </>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
