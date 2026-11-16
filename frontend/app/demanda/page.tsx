"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import PageHeader from "../../src/src/components/ui/PageHeader";
import KpiCard from "../../src/src/components/ui/KpiCard";
import Alert from "../../src/src/components/ui/Alert";
import Badge, { type BadgeTone } from "../../src/src/components/ui/Badge";
import Button from "../../src/src/components/ui/Button";
import Icon from "../../src/src/components/ui/Icon";
import Segmented from "../../src/src/components/ui/Segmented";
import Skeleton, { SkeletonRows } from "../../src/src/components/ui/Skeleton";
import { apiUrl } from "../../lib/api";
import { DEMANDA_URL, agruparPorDia, isoLocal, resumenSemana, type DemandaApiResponse, type ProductoApi } from "../../lib/demanda";

// ── API ───────────────────────────────────────────────────────────────────────

// Usuario de prueba fijo hasta unificar la identidad con Cognito (ver PENDIENTES-INTEGRACION, P1-1)
const CLIMA_URL = apiUrl("/clima?usuarioID=user_test_123");


interface DiaClima {
  fecha: string;
  tempMax: number | null;
  tempMin: number | null;
  probLluvia: number | null;
  precipitacionMm: number | null;
  codigoClima?: number | null;
  descripcion: string;
}

interface ClimaApiResponse {
  disponible?: boolean;
  ubicacion?: { ciudad?: string | null };
  dias?: DiaClima[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Confianza = "alta" | "media" | "baja";

const CONF_TONE: Record<Confianza, BadgeTone> = { alta: "success", media: "neutral", baja: "warning" };

const DIA_CORTO = ["do", "lu", "ma", "mi", "ju", "vi", "sá"];
const DIA_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const UNIDAD_PLURAL: Record<string, string> = {
  unidad: "unidades",
  porcion: "porciones",
  vaso: "vasos",
  kg: "kg",
};

/** La API manda la confianza como texto libre: si no es un valor conocido, no hay dato. */
function asConfianza(valor: string | undefined): Confianza | null {
  return valor === "alta" || valor === "media" || valor === "baja" ? valor : null;
}

function aFecha(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/** "sá 14" */
function diaCorto(iso: string): string {
  const d = aFecha(iso);
  return `${DIA_CORTO[d.getDay()]} ${d.getDate()}`;
}

/** "sábado 14" */
function diaLargo(iso: string): string {
  const d = aFecha(iso);
  return `${DIA_LARGO[d.getDay()]} ${d.getDate()}`;
}

/** "sábado 14/11" */
function diaConMes(iso: string): string {
  return `${diaLargo(iso)}/${iso.slice(5, 7)}`;
}

function llueve(d: DiaClima): boolean {
  return (d.probLluvia ?? 0) >= 60 || (d.precipitacionMm ?? 0) >= 2;
}

/** Ícono según el código de clima WMO que devuelve el pronóstico. */
function iconoClima(d: DiaClima): string {
  const c = d.codigoClima;
  if (c == null) return llueve(d) ? "rainy" : "thermostat";
  if (c === 0) return "sunny";
  if (c <= 2) return "partly_cloudy_day";
  if (c === 3) return "cloud";
  if (c === 45 || c === 48) return "foggy";
  if (c >= 95) return "thunderstorm";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "weather_snowy";
  return "rainy";
}

function lista(nombres: string[]): string {
  return nombres.length <= 1 ? nombres.join("") : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

const ALTO_BARRAS = 150;

// ── Página ────────────────────────────────────────────────────────────────────

export default function DemandaPage() {
  const [productos, setProductos] = useState<ProductoApi[]>([]);
  const [precision, setPrecision] = useState<number | null>(null);
  const [origen, setOrigen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // El clima acompaña al gráfico: si no está disponible, su fila no se muestra
  const [clima, setClima] = useState<DiaClima[]>([]);
  const [climaCiudad, setClimaCiudad] = useState<string | null>(null);
  const [climaLoading, setClimaLoading] = useState(true);

  const [diaElegido, setDiaElegido] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setClimaLoading(true);
    setError(false);

    const prediccion = (async () => {
      try {
        const response = await fetch(DEMANDA_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as DemandaApiResponse;
        setProductos((data.produccion ?? []).filter((p) => p.fecha));
        setPrecision(data.precision ?? null);
        setOrigen(data.origen ?? null);
      } catch {
        setProductos([]);
        setError(true);
      } finally {
        setLoading(false);
      }
    })();

    const pronostico = (async () => {
      try {
        const response = await fetch(CLIMA_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as ClimaApiResponse;
        setClima(data.disponible === false ? [] : (data.dias ?? []));
        setClimaCiudad(data.ubicacion?.ciudad ?? null);
      } catch {
        setClima([]);
      } finally {
        setClimaLoading(false);
      }
    })();

    await Promise.all([prediccion, pronostico]);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // ── Datos derivados ────────────────────────────────────────────────────────

  const dias = useMemo(() => agruparPorDia(productos), [productos]);

  const manana = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoLocal(d);
  }, []);

  // Por defecto, mañana; si la predicción no lo incluye, el primer día que haya
  const dia = dias.find((d) => d.fecha === diaElegido) ?? dias.find((d) => d.fecha === manana) ?? dias[0];

  const { total, pico, picoPct } = resumenSemana(dias);
  const maximo = Math.max(1, ...dias.map((d) => d.total));

  const enRiesgo = new Set(productos.filter((p) => asConfianza(p.confianza) === "baja").map((p) => p.productoID)).size;
  const climaPorFecha = new Map(clima.map((d) => [d.fecha, d]));
  const hayClima = dias.some((d) => climaPorFecha.has(d.fecha));
  const sinIa = origen?.trim().toLowerCase() === "reglas";
  const hayDatos = !loading && !error && dias.length > 0;
  const sinPrediccion = !loading && !error && dias.length === 0;
  const hoy = isoLocal(new Date());
  const columnasClima: React.CSSProperties = { display: "grid", gridTemplateColumns: `repeat(${clima.length || 7}, minmax(0, 1fr))` };

  const columnas: React.CSSProperties = { display: "grid", gridTemplateColumns: `repeat(${dias.length || 7}, minmax(0, 1fr))` };

  return (
    <AppLayout activeTab="demanda">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div className="no-print">
          <PageHeader
            title="Predicción de demanda"
            subtitle="Cuánto producir en los próximos días, según tu historial de ventas y el clima."
            action={
              <Button id="btn-recalcular-demanda" variant="primary" icon="autorenew" disabled={loading} onClick={() => void cargar()}>
                {loading ? "actualizando…" : "actualizar"}
              </Button>
            }
          />

          {/* ── Error ──────────────────────────────────────────────────────── */}
          {error && (
            <div style={{ marginBottom: 16 }}>
              <Alert
                id="demanda-error"
                tone="warning"
                icon="error"
                action={
                  <Button variant="warning" size="sm" icon="refresh" onClick={() => void cargar()}>
                    reintentar
                  </Button>
                }
              >
                No pudimos cargar la predicción. Probá de nuevo en unos segundos.
              </Alert>
            </div>
          )}

          {/* ── Caso excepcional: la predicción no la hizo la IA ───────────── */}
          {hayDatos && sinIa && (
            <div style={{ marginBottom: 16 }}>
              <Alert tone="warning" icon="info">
                <strong>Calculado sin IA.</strong> La IA no respondió, así que estos números salen de un cálculo automático más simple.
              </Alert>
            </div>
          )}

          {/* ── Pico de la semana ──────────────────────────────────────────── */}
          {hayDatos && pico && dias.length > 1 && picoPct >= 10 && (
            <div style={{ marginBottom: 16 }}>
              <Alert id="demanda-pico" tone="ia" icon="trending_up">
                <strong>
                  El {diaLargo(pico.fecha)} se espera el pico: +{picoPct}% sobre el promedio diario.
                </strong>{" "}
                Lo que más vas a necesitar ese día: {lista(pico.items.slice(0, 2).map((p) => p.nombre.toLowerCase()))}.
              </Alert>
            </div>
          )}

          {/* ── KPIs ───────────────────────────────────────────────────────── */}
          {!error && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
              <KpiCard
                id="kpi-produccion"
                label={dias.length > 0 ? `Producción prevista, próximos ${dias.length} días` : "Producción prevista"}
                loading={loading}
                value={dias.length > 0 ? <>{total.toLocaleString("es-AR")} <small>unidades</small></> : "—"}
                footer={dias.length > 0 ? `de ${diaLargo(dias[0].fecha)} a ${diaLargo(dias[dias.length - 1].fecha)}` : "todavía no hay una predicción"}
              />
              <KpiCard
                id="kpi-precision"
                label="Precisión de la predicción"
                loading={loading}
                value={precision != null ? `${(precision * 100).toFixed(1).replace(".", ",")}%` : "—"}
                footer={precision != null ? "comparada con lo vendido los últimos 7 días" : "todavía no hay ventas para comparar"}
              />
              <KpiCard
                id="kpi-riesgo"
                label="Productos en riesgo de faltante"
                loading={loading}
                isAlert={enRiesgo > 0}
                value={dias.length > 0 ? enRiesgo : "—"}
                footer={
                  dias.length === 0
                    ? "todavía no hay una predicción"
                    : enRiesgo > 0
                      ? "su predicción tiene confianza baja"
                      : "ninguna predicción tiene confianza baja"
                }
              />
            </div>
          )}

          {/* ── Sin predicción ─────────────────────────────────────────────── */}
          {sinPrediccion && (
            <section className="card" style={{ marginBottom: 16 }}>
              <div className="empty-state">
                <p>Todavía no hay una predicción para los próximos días. Cuando la haya, vas a ver acá cuánto producir cada día.</p>
              </div>
            </section>
          )}

          {/* ── Sin predicción, el pronóstico se muestra igual (con predicción va debajo del gráfico) ── */}
          {sinPrediccion && (climaLoading || clima.length > 0) && (
            <section id="demanda-clima" className="card" style={{ marginBottom: 16 }}>
              <header className="card-header">
                <h2 className="card-title">
                  <Icon name="partly_cloudy_day" size={16} />
                  Pronóstico del clima
                </h2>
                {climaCiudad && (
                  <span style={{ fontSize: 12, lineHeight: "16px", color: "var(--color-text-secondary)" }}>para {climaCiudad}</span>
                )}
              </header>
              {climaLoading ? (
                <div role="status" aria-label="Cargando el pronóstico" style={{ ...columnasClima, padding: "16px" }}>
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i} style={{ display: "flex", justifyContent: "center" }}>
                      <Skeleton width={44} height={64} />
                    </span>
                  ))}
                </div>
              ) : (
                <ol style={{ ...columnasClima, minWidth: 0, margin: 0, padding: "16px", listStyle: "none", overflowX: "auto" }}>
                  {clima.map((d) => {
                    const lluvia = llueve(d);
                    const esHoy = d.fecha === hoy;
                    return (
                      <li key={d.fecha} title={d.descripcion} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 64, color: "var(--color-text-secondary)" }}>
                        <span style={{ fontSize: 12, lineHeight: "16px", fontWeight: esHoy ? 500 : 400, color: esHoy ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>
                          {diaCorto(d.fecha)}
                          {esHoy && ", hoy"}
                        </span>
                        <span style={{ display: "flex", marginTop: 6 }}>
                          <Icon name={iconoClima(d)} size={20} />
                        </span>
                        <span className="sr-only">{d.descripcion}, máxima </span>
                        <span className="num" style={{ fontSize: 13, lineHeight: "18px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                          {d.tempMax != null ? `${Math.round(d.tempMax)}°` : "—"}
                          {d.tempMin != null && (
                            <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}>
                              <span className="sr-only">, mínima</span> {Math.round(d.tempMin)}°
                            </span>
                          )}
                        </span>
                        {d.probLluvia != null && (
                          <span className="num" style={{ fontSize: 11, lineHeight: "14px", fontWeight: lluvia ? 500 : 400, color: lluvia ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>
                            {Math.round(d.probLluvia)}% lluvia
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          )}

          {/* ── Gráfico: producción por día, con el clima debajo ───────────── */}
          {(loading || hayDatos) && (
            <section id="demanda-grafico" className="card" style={{ marginBottom: 16 }}>
              <header className="card-header">
                <h2 className="card-title">
                  <Icon name="bar_chart" size={16} />
                  Producción prevista por día
                </h2>
                {hayDatos && hayClima && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, lineHeight: "16px", color: "var(--color-text-secondary)" }}>
                    <Icon name="water_drop" size={14} />
                    los días con lluvia, la producción prevista baja
                  </span>
                )}
              </header>

              {loading ? (
                <div role="status" aria-label="Cargando la predicción" style={{ ...columnas, alignItems: "end", height: ALTO_BARRAS + 60, padding: "20px 16px" }}>
                  {[70, 40, 55, 50, 65, 60, 75].map((h, i) => (
                    <span key={i} style={{ display: "flex", justifyContent: "center" }}>
                      <Skeleton width="56%" height={h * 1.6} />
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "20px 16px 16px", overflowX: "auto" }}>
                  <ol style={{ ...columnas, minWidth: 520, margin: 0, padding: 0, listStyle: "none" }}>
                    {dias.map((d) => {
                      const esPico = d === pico && dias.length > 1;
                      const pronostico = climaPorFecha.get(d.fecha);
                      const lluvia = pronostico ? llueve(pronostico) : false;
                      return (
                        <li key={d.fecha} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              width: "100%",
                              height: ALTO_BARRAS + 24,
                              borderBottom: "1px solid var(--color-border)",
                            }}
                          >
                            <span
                              className="num"
                              style={{
                                marginBottom: 4,
                                fontSize: 13,
                                lineHeight: "18px",
                                fontWeight: 500,
                                color: esPico ? "var(--color-accent-dark)" : "var(--color-text-primary)",
                              }}
                            >
                              {d.total.toLocaleString("es-AR")}
                              <span className="sr-only"> unidades</span>
                            </span>
                            <span
                              aria-hidden="true"
                              style={{
                                width: "56%",
                                height: Math.max(4, Math.round((d.total / maximo) * ALTO_BARRAS)),
                                borderRadius: "4px 4px 0 0",
                                backgroundColor: esPico ? "var(--color-accent)" : "var(--color-bar-predicted)",
                              }}
                            />
                          </div>

                          <span
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              lineHeight: "16px",
                              textAlign: "center",
                              fontWeight: d.fecha === manana ? 500 : 400,
                              color: d.fecha === manana ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                            }}
                          >
                            {diaCorto(d.fecha)}
                            {d.fecha === manana && ", mañana"}
                          </span>

                          {/* Clima del día: información, no advertencia */}
                          {climaLoading ? (
                            <span style={{ marginTop: 14 }}>
                              <Skeleton width={36} height={34} />
                            </span>
                          ) : (
                            hayClima && (
                              <div
                                title={pronostico?.descripcion}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: 2,
                                  width: "100%",
                                  minHeight: 62,
                                  marginTop: 10,
                                  paddingTop: 10,
                                  borderTop: "1px dashed var(--color-border-divider)",
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                {pronostico && (
                                  <>
                                    <Icon name={iconoClima(pronostico)} size={20} />
                                    <span className="sr-only">{pronostico.descripcion}, máxima </span>
                                    <span className="num" style={{ fontSize: 13, lineHeight: "18px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                                      {pronostico.tempMax != null ? `${Math.round(pronostico.tempMax)}°` : "—"}
                                    </span>
                                    {pronostico.probLluvia != null && (
                                      <span
                                        className="num"
                                        style={{
                                          fontSize: 11,
                                          lineHeight: "14px",
                                          textAlign: "center",
                                          fontWeight: lluvia ? 500 : 400,
                                          color: lluvia ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                                        }}
                                      >
                                        {Math.round(pronostico.probLluvia)}% lluvia
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  {hayClima && climaCiudad && (
                    <p style={{ margin: "10px 0 0", fontSize: 11, lineHeight: "14px", color: "var(--color-text-secondary)", textAlign: "right" }}>
                      pronóstico para {climaCiudad}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Producción sugerida del día elegido (es lo único que se imprime) ── */}
        {loading && (
          <section className="card no-print">
            <header className="card-header">
              <h2 className="card-title">Producción sugerida</h2>
            </header>
            <SkeletonRows rows={4} label="Cargando la producción sugerida" />
          </section>
        )}

        {hayDatos && dia && (
          <section id="demanda-produccion" className="card print-area" style={{ overflow: "hidden" }}>
            <header className="card-header">
              <h2 className="card-title" style={{ flexWrap: "wrap" }}>
                Producción sugerida
                <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-text-secondary)" }}>{diaConMes(dia.fecha)}</span>
                {!sinIa && (
                  <span className="no-print" style={{ display: "inline-flex" }}>
                    <Badge tone="ia">IA</Badge>
                  </span>
                )}
              </h2>
              <span className="no-print">
                <Button id="btn-imprimir" size="sm" icon="print" onClick={() => window.print()}>
                  imprimir lista
                </Button>
              </span>
            </header>

            {dias.length > 1 && (
              <div className="no-print" style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)", overflowX: "auto" }}>
                <Segmented
                  label="día de producción"
                  value={dia.fecha}
                  onChange={setDiaElegido}
                  options={dias.map((d) => ({ value: d.fecha, label: diaCorto(d.fecha) }))}
                />
              </div>
            )}

            <div role="table" aria-label={`Producción sugerida para el ${diaConMes(dia.fecha)}`}>
              <div role="row" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 160px 140px", columnGap: 16, padding: "10px 16px", backgroundColor: "var(--color-bg)" }}>
                {[
                  { label: "Producto", align: "left" as const },
                  { label: "Cantidad", align: "right" as const },
                  { label: "Confianza", align: "center" as const },
                ].map((h) => (
                  <span key={h.label} role="columnheader" style={{ fontSize: 12, lineHeight: "16px", fontWeight: 500, color: "var(--color-text-secondary)", textAlign: h.align }}>
                    {h.label}
                  </span>
                ))}
              </div>

              {dia.items.map((item) => {
                const confianza = asConfianza(item.confianza);
                const riesgo = confianza === "baja";
                const unidad = item.unidadProducto ? (UNIDAD_PLURAL[item.unidadProducto] ?? item.unidadProducto) : "unidades";
                return (
                  <div
                    key={item.productoID}
                    role="row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 160px 140px",
                      columnGap: 16,
                      alignItems: "center",
                      padding: "12px 16px",
                      borderTop: "1px solid var(--color-border-subtle)",
                      backgroundColor: riesgo ? "var(--color-surface-flag)" : undefined,
                      fontSize: 13,
                      lineHeight: "18px",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    <span role="cell" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontWeight: 500 }}>
                      {riesgo && (
                        <span style={{ display: "flex", color: "var(--color-warning-text)" }}>
                          <Icon name="warning" size={14} />
                        </span>
                      )}
                      <span style={{ overflowWrap: "anywhere" }}>{item.nombre}</span>
                    </span>
                    <span role="cell" className="num" style={{ textAlign: "right" }}>
                      {item.cantidad.toLocaleString("es-AR")}{" "}
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{unidad}</span>
                    </span>
                    <span role="cell" style={{ textAlign: "center" }}>
                      <Badge tone={confianza ? CONF_TONE[confianza] : "neutral"}>{confianza ?? "sin dato"}</Badge>
                    </span>
                  </div>
                );
              })}
            </div>

            <p
              className="no-print"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                margin: 0,
                padding: "12px 16px",
                borderTop: "1px solid var(--color-border)",
                fontSize: 12,
                lineHeight: "17px",
                color: "var(--color-text-secondary)",
              }}
            >
              <Icon name="info" size={14} />
              La confianza dice qué tan segura es la predicción de cada producto. «Sin dato» significa que no la recibimos.
            </p>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
