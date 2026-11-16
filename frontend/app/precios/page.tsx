"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import {
  sugerirPreciosConIA,
  obtenerUltimaSugerencia,
  aplicarPrecioIndividual,
  esAjusteRecomendado,
  margen,
  margenPromedio as calcularMargenPromedio,
  type ResultadoPrecios,
  type SugerenciaPrecio,
} from "../../lib/precios";
import { formatMoneda } from "../../lib/formato";
import PageHeader from "../../src/src/components/ui/PageHeader";
import Badge from "../../src/src/components/ui/Badge";
import Button from "../../src/src/components/ui/Button";
import Alert from "../../src/src/components/ui/Alert";
import ConfirmDialog from "../../src/src/components/ui/ConfirmDialog";
import Icon from "../../src/src/components/ui/Icon";
import KpiCard from "../../src/src/components/ui/KpiCard";
import Segmented from "../../src/src/components/ui/Segmented";
import { SkeletonRows } from "../../src/src/components/ui/Skeleton";
import { useToast } from "../../src/src/components/ui/Toast";

type Filtro = "todos" | "revisar" | "estables";

// Igual a lo que dura en pantalla un toast con acción: mientras se puede "deshacer",
// el precio todavía no se mandó al servidor (la API no tiene forma de revertirlo).
const VENTANA_DESHACER_MS = 8000;

const GRID = "minmax(0, 2fr) 96px 96px 104px 92px 130px 170px";

const th: React.CSSProperties = {
  fontSize: 12,
  lineHeight: "16px",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
  textAlign: "right",
  whiteSpace: "nowrap",
};

const groupHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 44,
  padding: "6px 16px",
  borderTop: "1px solid var(--color-border)",
  backgroundColor: "var(--color-bg)",
  fontSize: 12,
  lineHeight: "16px",
  fontWeight: 500,
};

// ── Funciones auxiliares ─────────────────────────────────────────────────────

function formatPct(val: number | null | undefined, conSigno = true): string {
  if (val == null || !Number.isFinite(val)) return "—";
  const abs = Math.abs(val).toFixed(1).replace(".", ",");
  if (!conSigno) return `${val < 0 ? "−" : ""}${abs}%`;
  if (Math.abs(val) < 0.05) return "0%";
  return `${val > 0 ? "+" : "−"}${abs}%`;
}

function formatActualizado(fecha: string): string {
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return "";
  const dia = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(date);
  const hora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `actualizado ${dia}, ${hora}`;
}

/** "te-con-leche" → "te con leche": de los productos sin costo solo llega el identificador. */
function nombreDesdeId(id: string): string {
  return id.replace(/[-_]+/g, " ");
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function PreciosPage() {
  const toast = useToast();

  const [resultado, setResultado] = useState<ResultadoPrecios | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculando, setRecalculando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Qué falló, para que "reintentar" repita lo mismo: leer la última sugerencia o recalcular con IA
  const [fallo, setFallo] = useState<"leer" | "recalcular">("leer");

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [abierto, setAbierto] = useState<string | null>(null); // fila con "por qué" desplegado
  const [porConfirmar, setPorConfirmar] = useState<SugerenciaPrecio[] | null>(null);

  // Precios aplicados en esta visita. Se marcan apenas se confirma; el envío real
  // espera a que pase la ventana de "deshacer".
  const [aplicados, setAplicados] = useState<Set<string>>(new Set());
  const [enviosPendientes, setEnviosPendientes] = useState(0);
  const lotes = useRef(new Set<{ timer: ReturnType<typeof setTimeout>; enviar: () => Promise<void> }>());
  const montado = useRef(true);

  // ── Consulta ───────────────────────────────────────────────────────────────

  // Al entrar se lee la última sugerencia guardada (GET, sin IA). La IA corre solo con "recalcular con IA".
  const consultar = useCallback(async (accion: "leer" | "recalcular") => {
    setLoading(true);
    if (accion === "recalcular") setRecalculando(true);
    setError(null);
    try {
      const r = accion === "recalcular" ? await sugerirPreciosConIA() : await obtenerUltimaSugerencia();
      setResultado(r);
      // Lo que ya se aplicó desde esta sugerencia arranca marcado como aplicado
      setAplicados(new Set(r.sugerencias.filter((s) => s.aplicada).map((s) => s.productoID)));
      setAbierto(null);
    } catch (err: unknown) {
      setFallo(accion);
      setError(err instanceof Error ? err.message : "No pudimos conectar con el servicio de precios.");
    } finally {
      setLoading(false);
      setRecalculando(false);
    }
  }, []);

  const cargarUltima = useCallback(() => consultar("leer"), [consultar]);
  const recalcular = useCallback(() => consultar("recalcular"), [consultar]);

  useEffect(() => {
    void cargarUltima();
  }, [cargarUltima]);

  // Al salir de la pantalla, lo que estaba esperando la ventana de "deshacer" se envía ya
  useEffect(() => {
    montado.current = true;
    const pendientes = lotes.current;
    return () => {
      montado.current = false;
      pendientes.forEach((lote) => {
        clearTimeout(lote.timer);
        void lote.enviar();
      });
      pendientes.clear();
    };
  }, []);

  // ── Aplicar precios ────────────────────────────────────────────────────────

  function aplicar(items: SugerenciaPrecio[]) {
    const sugerenciaID = resultado?.sugerenciaPrecioID;
    setPorConfirmar(null);
    if (!sugerenciaID) {
      toast({ tone: "error", message: "No pudimos aplicar el precio. Recalculá las sugerencias y probá de nuevo." });
      return;
    }

    const ids = items.map((i) => i.productoID);
    const marcar = (aplicado: boolean, cuales: string[]) =>
      setAplicados((prev) => {
        const next = new Set(prev);
        cuales.forEach((id) => (aplicado ? next.add(id) : next.delete(id)));
        return next;
      });

    const lote = {
      timer: setTimeout(() => void lote.enviar(), VENTANA_DESHACER_MS),
      enviar: async () => {
        lotes.current.delete(lote);
        const fallidos: SugerenciaPrecio[] = [];
        for (const item of items) {
          try {
            await aplicarPrecioIndividual(sugerenciaID, item.productoID);
          } catch {
            fallidos.push(item);
          }
        }
        if (!montado.current) return;
        setEnviosPendientes((n) => n - 1);
        if (fallidos.length > 0) {
          marcar(false, fallidos.map((i) => i.productoID));
          toast({
            tone: "error",
            message:
              fallidos.length === 1
                ? `No pudimos aplicar el precio de ${fallidos[0].nombre}. Probá de nuevo.`
                : `No pudimos aplicar ${fallidos.length} precios. Probá de nuevo.`,
          });
        }
      },
    };
    lotes.current.add(lote);
    setEnviosPendientes((n) => n + 1);
    marcar(true, ids);

    toast({
      message:
        items.length === 1 ? (
          <>Precio de <strong>{items[0].nombre}</strong> aplicado: {formatMoneda(items[0].precioSugerido)}</>
        ) : (
          `${items.length} precios aplicados`
        ),
      action: {
        label: "deshacer",
        onClick: () => {
          if (!lotes.current.delete(lote)) return; // ya se envió
          clearTimeout(lote.timer);
          setEnviosPendientes((n) => n - 1);
          marcar(false, ids);
        },
      },
    });
  }

  // ── Datos derivados ────────────────────────────────────────────────────────

  const sugerencias = useMemo(() => resultado?.sugerencias ?? [], [resultado]);
  const productosSinCosto = resultado?.productosSinCosto ?? [];

  const requiereRevision = useCallback(
    (item: SugerenciaPrecio) => esAjusteRecomendado(item) && !aplicados.has(item.productoID),
    [aplicados]
  );

  const aRevisar = useMemo(() => sugerencias.filter(requiereRevision), [sugerencias, requiereRevision]);
  const totalEstables = sugerencias.length - aRevisar.length;

  const margenPromedio = useMemo(() => calcularMargenPromedio(sugerencias, aplicados), [sugerencias, aplicados]);

  const aumentos = aRevisar.filter((i) => i.variacionPrecio > 0);
  const aumentoPromedio =
    aumentos.length > 0 ? aumentos.reduce((a, i) => a + i.variacionPrecio, 0) / aumentos.length : null;

  const visibles = useMemo(() => {
    const query = busqueda.trim().toLowerCase();
    return sugerencias.filter((item) => {
      const revisar = requiereRevision(item);
      if (filtro === "revisar" && !revisar) return false;
      if (filtro === "estables" && revisar) return false;
      return !query || item.nombre.toLowerCase().includes(query);
    });
  }, [sugerencias, filtro, busqueda, requiereRevision]);

  const visiblesRevisar = visibles.filter(requiereRevision);
  const visiblesEstables = visibles.filter((i) => !requiereRevision(i));
  const hayResultados = !loading && sugerencias.length > 0;

  // ── Filas ──────────────────────────────────────────────────────────────────

  function fila(item: SugerenciaPrecio, primera: boolean) {
    const revisar = requiereRevision(item);
    const aplicado = aplicados.has(item.productoID);
    const expandido = abierto === item.productoID;
    const precioVigente = aplicado ? item.precioSugerido : item.precioActual;
    const margenVigente = aplicado ? item.margenResultante : margen(item.precioActual, item.costoActual);
    const fondo = revisar ? "var(--color-surface-flag)" : undefined;
    const detalleId = `porque-${item.productoID}`;

    return (
      <Fragment key={item.productoID}>
        <div
          role="row"
          style={{
            display: "grid",
            gridTemplateColumns: GRID,
            columnGap: 16,
            alignItems: "center",
            padding: "10px 16px",
            borderTop: primera ? "none" : "1px solid var(--color-border-subtle)",
            backgroundColor: fondo,
            fontSize: 13,
            lineHeight: "18px",
            color: "var(--color-text-primary)",
          }}
        >
          <div role="cell" style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: revisar ? 500 : 400, overflowWrap: "anywhere" }}>{item.nombre}</p>
            {item.unidadProducto && (
              <p style={{ margin: "2px 0 0", fontSize: 12, lineHeight: "16px", color: "var(--color-text-secondary)" }}>
                por {item.unidadProducto.toLowerCase()}
              </p>
            )}
          </div>

          <div role="cell" className="num" style={{ textAlign: "right" }}>
            {formatMoneda(item.costoActual)}
            {item.variacionCosto != null && Math.abs(item.variacionCosto) >= 0.05 && (
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  lineHeight: "14px",
                  color: item.variacionCosto > 0 ? "var(--color-warning-text)" : "var(--color-text-secondary)",
                }}
              >
                <span className="sr-only">variación del costo: </span>
                {formatPct(item.variacionCosto)}
              </p>
            )}
          </div>

          <span role="cell" className="num" style={{ textAlign: "right" }}>{formatMoneda(precioVigente)}</span>

          <span
            role="cell"
            className="num"
            style={{
              textAlign: "right",
              fontWeight: revisar ? 500 : 400,
              color: revisar ? "var(--color-accent-dark)" : "var(--color-text-secondary)",
            }}
          >
            {formatMoneda(item.precioSugerido)}
          </span>

          <span
            role="cell"
            className="num"
            style={{
              textAlign: "right",
              fontWeight: revisar ? 500 : 400,
              color: revisar && item.variacionPrecio > 0 ? "var(--color-warning-text)" : "var(--color-text-secondary)",
            }}
          >
            {aplicado ? "0%" : formatPct(item.variacionPrecio)}
          </span>

          <span role="cell" className="num" style={{ textAlign: "right" }}>
            {formatPct(margenVigente, false)}
            {revisar && (
              <>
                {" "}
                <span aria-hidden="true">→</span>
                <span className="sr-only"> pasa a </span>{" "}
                <span style={{ fontWeight: 500, color: "var(--color-success-text)" }}>{formatPct(item.margenResultante, false)}</span>
              </>
            )}
          </span>

          <div role="cell" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            {revisar ? (
              <>
                <Button
                  id={`btn-porque-${item.productoID}`}
                  variant="text"
                  size="sm"
                  iconEnd={expandido ? "expand_less" : "expand_more"}
                  aria-expanded={expandido}
                  aria-controls={detalleId}
                  onClick={() => setAbierto(expandido ? null : item.productoID)}
                >
                  por qué
                </Button>
                <Button
                  id={`btn-aplicar-${item.productoID}`}
                  variant="accent"
                  size="sm"
                  aria-label={`aplicar ${formatMoneda(item.precioSugerido)} a ${item.nombre}`}
                  onClick={() => setPorConfirmar([item])}
                >
                  aplicar
                </Button>
              </>
            ) : aplicado ? (
              <Badge tone="success">aplicado</Badge>
            ) : (
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>al día</span>
            )}
          </div>
        </div>

        {revisar && expandido && (
          <div id={detalleId} style={{ padding: "0 16px 12px", backgroundColor: fondo }}>
            <div
              style={{
                padding: "12px 14px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                backgroundColor: "var(--color-accent-tint)",
                color: "var(--color-text-callout)",
                fontSize: 13,
                lineHeight: "19px",
              }}
            >
              <p style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 4px", fontWeight: 500, color: "var(--color-accent-dark)" }}>
                <Icon name="auto_awesome" size={14} />
                Por qué este precio
              </p>
              <p style={{ margin: 0, maxWidth: "80ch" }}>
                {item.razonamiento || "La IA no dio una explicación para esta sugerencia."}
              </p>
              {item.superaTopeSuba && (
                <p style={{ margin: "6px 0 0", fontWeight: 500, color: "var(--color-warning-text)" }}>
                  La suba supera el tope de aumento que usamos como referencia.
                </p>
              )}
            </div>
          </div>
        )}
      </Fragment>
    );
  }

  // ── Renderizado ────────────────────────────────────────────────────────────

  const uno = porConfirmar?.length === 1 ? porConfirmar[0] : null;

  return (
    <AppLayout activeTab="precios">
      <div style={{ maxWidth: 1200 }}>
        <PageHeader
          title="Precios sugeridos"
          badge={<Badge tone="ia">IA</Badge>}
          subtitle="Calculados con tus recetas, el costo de tus insumos y tu margen objetivo."
          action={
            <>
              {resultado?.fechaGeneracion && !loading && (
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {formatActualizado(resultado.fechaGeneracion)}
                </span>
              )}
              <Button
                id="btn-recalcular"
                variant="primary"
                icon="refresh"
                disabled={recalculando || enviosPendientes > 0}
                onClick={() => void recalcular()}
              >
                {recalculando ? "calculando…" : "recalcular con IA"}
              </Button>
            </>
          }
        />

        {/* ── Indicadores ──────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
          <KpiCard
            id="kpi-revisar"
            label="Requieren revisión"
            loading={loading}
            isAlert={aRevisar.length > 0}
            value={<>{aRevisar.length} <small>{aRevisar.length === 1 ? "producto" : "productos"}</small></>}
            footer={aRevisar.length > 0 ? "la IA sugiere cambiar su precio" : "ningún precio para cambiar"}
            onClick={aRevisar.length > 0 ? () => setFiltro("revisar") : undefined}
          />
          <KpiCard
            id="kpi-margen"
            label="Margen promedio"
            loading={loading}
            value={formatPct(margenPromedio, false)}
            footer="con tus precios de hoy"
          />
          <KpiCard
            id="kpi-aumento"
            label="Aumento promedio sugerido"
            ia
            loading={loading}
            value={aumentoPromedio != null ? formatPct(aumentoPromedio) : "—"}
            footer={
              aumentos.length === 0
                ? "sin aumentos sugeridos"
                : aumentos.length === 1
                  ? "en 1 producto a revisar"
                  : `en ${aumentos.length} productos a revisar`
            }
          />
        </div>

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div style={{ marginBottom: 16 }}>
            <Alert
              tone="warning"
              icon="error"
              action={
                <Button variant="warning" size="sm" disabled={loading} onClick={() => void (fallo === "recalcular" ? recalcular() : cargarUltima())}>
                  reintentar
                </Button>
              }
            >
              <strong>{fallo === "recalcular" ? "No pudimos calcular los precios sugeridos." : "No pudimos leer los precios sugeridos."}</strong> {error}
            </Alert>
          </div>
        )}

        {/* ── Todo al día ──────────────────────────────────────────────────── */}
        {hayResultados && aRevisar.length === 0 && (
          <div style={{ marginBottom: 16 }}>
            <Alert id="precios-al-dia" tone="success">
              Todos tus precios están al día: la IA no sugiere ningún cambio.
            </Alert>
          </div>
        )}

        {/* ── Filtros ──────────────────────────────────────────────────────── */}
        {hayResultados && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <Segmented
              label="estado del precio"
              value={filtro}
              onChange={setFiltro}
              options={[
                { value: "todos", label: "todos", count: sugerencias.length },
                { value: "revisar", label: "requieren revisión", count: aRevisar.length },
                { value: "estables", label: "estables", count: totalEstables },
              ]}
            />
            <div style={{ position: "relative", width: 260, maxWidth: "100%" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", color: "var(--color-text-secondary)", pointerEvents: "none" }}>
                <Icon name="search" size={16} />
              </span>
              <input
                id="buscar-producto"
                type="text"
                role="searchbox"
                aria-label="buscar producto"
                placeholder="buscar producto"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="input"
                style={{ padding: "7px 10px 7px 32px" }}
              />
            </div>
          </div>
        )}

        {/* ── Tabla ────────────────────────────────────────────────────────── */}
        {(loading || hayResultados) && (
          <section id="tabla-precios" className="card" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <div role="table" aria-label="Precios sugeridos por producto" style={{ minWidth: 860 }}>
                <div role="row" style={{ display: "grid", gridTemplateColumns: GRID, columnGap: 16, padding: "10px 16px" }}>
                  <span role="columnheader" style={{ ...th, textAlign: "left" }}>Producto</span>
                  <span role="columnheader" style={th}>Costo</span>
                  <span role="columnheader" style={th}>Actual</span>
                  <span role="columnheader" style={th}>Sugerido</span>
                  <span role="columnheader" style={th}>Variación</span>
                  <span role="columnheader" style={th}>Margen</span>
                  <span role="columnheader" className="sr-only">Acciones</span>
                </div>

                {loading ? (
                  <div style={{ borderTop: "1px solid var(--color-border)" }}>
                    <p style={{ margin: 0, padding: "14px 16px 2px", fontSize: 13, color: "var(--color-text-secondary)" }}>
                      Calculando precios sugeridos… puede tardar unos segundos.
                    </p>
                    <SkeletonRows rows={5} label="Calculando precios sugeridos" />
                  </div>
                ) : visibles.length === 0 ? (
                  <div className="empty-state" style={{ borderTop: "1px solid var(--color-border)" }}>
                    <p>No hay productos con esos filtros.</p>
                    <Button
                      size="sm"
                      onClick={() => {
                        setFiltro("todos");
                        setBusqueda("");
                      }}
                    >
                      limpiar filtros
                    </Button>
                  </div>
                ) : (
                  <>
                    {visiblesRevisar.length > 0 && (
                      <>
                        <div style={{ ...groupHeader, color: "var(--color-warning-text)" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Icon name="warning" size={14} />
                            Requieren revisión ({visiblesRevisar.length})
                          </span>
                          {visiblesRevisar.length > 1 && (
                            <Button id="btn-aplicar-todos" variant="text" size="sm" onClick={() => setPorConfirmar(visiblesRevisar)}>
                              aplicar los {visiblesRevisar.length} sugeridos
                            </Button>
                          )}
                        </div>
                        {visiblesRevisar.map((item, i) => fila(item, i === 0))}
                      </>
                    )}
                    {visiblesEstables.length > 0 && (
                      <>
                        <div style={{ ...groupHeader, color: "var(--color-success-text)" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Icon name="check_circle" size={14} />
                            Estables ({visiblesEstables.length}): la IA no sugiere cambios
                          </span>
                        </div>
                        {visiblesEstables.map((item, i) => fila(item, i === 0))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Sin sugerencias ──────────────────────────────────────────────── */}
        {!loading && !error && sugerencias.length === 0 && (
          <section className="card">
            <div className="empty-state">
              <p>
                <strong>Todavía no hay sugerencias.</strong> Calculalas con la IA a partir de tus costos actuales.
              </p>
              <Button variant="primary" size="sm" icon="refresh" disabled={recalculando} onClick={() => void recalcular()}>
                recalcular con IA
              </Button>
            </div>
          </section>
        )}

        {/* ── Productos sin costo ──────────────────────────────────────────── */}
        {!loading && productosSinCosto.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Alert id="precios-sin-costo" tone="warning">
              <strong>
                {productosSinCosto.length === 1
                  ? "1 producto quedó sin precio sugerido"
                  : `${productosSinCosto.length} productos quedaron sin precio sugerido`}
              </strong>
              : {productosSinCosto.map((p) => nombreDesdeId(p.productoID)).join(", ")}. Cargá la receta de{" "}
              {productosSinCosto.length === 1 ? "este producto" : "estos productos"} para que podamos calcular su costo.
            </Alert>
          </div>
        )}
      </div>

      {/* ── Confirmación ───────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={porConfirmar != null}
        title={uno ? "¿Aplicar el precio sugerido?" : `¿Aplicar los ${porConfirmar?.length ?? 0} precios sugeridos?`}
        description={uno ? `${uno.nombre}${uno.unidadProducto ? `, por ${uno.unidadProducto.toLowerCase()}` : ""}` : undefined}
        confirmLabel={uno ? `aplicar ${formatMoneda(uno.precioSugerido)}` : `aplicar los ${porConfirmar?.length ?? 0} precios`}
        onCancel={() => setPorConfirmar(null)}
        onConfirm={() => porConfirmar && aplicar(porConfirmar)}
      >
        {uno ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                backgroundColor: "var(--color-bg)",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 12, lineHeight: "16px", color: "var(--color-text-secondary)" }}>precio actual</p>
                <p className="num" style={{ margin: "2px 0 0", fontSize: 18, lineHeight: "24px", fontWeight: 500 }}>{formatMoneda(uno.precioActual)}</p>
              </div>
              <span style={{ display: "flex", color: "var(--color-text-secondary)" }}>
                <Icon name="arrow_forward" size={20} />
              </span>
              <div>
                <p style={{ margin: 0, fontSize: 12, lineHeight: "16px", color: "var(--color-text-secondary)" }}>nuevo precio</p>
                <p className="num" style={{ margin: "2px 0 0", fontSize: 18, lineHeight: "24px", fontWeight: 500, color: "var(--color-accent-dark)" }}>
                  {formatMoneda(uno.precioSugerido)}{" "}
                  <span style={{ fontSize: 12, fontWeight: 400, color: uno.variacionPrecio > 0 ? "var(--color-warning-text)" : "var(--color-text-secondary)" }}>
                    {formatPct(uno.variacionPrecio)}
                  </span>
                </p>
              </div>
            </div>
            <p className="num" style={{ display: "flex", justifyContent: "space-between", gap: 12, margin: "14px 0 0", fontSize: 13, lineHeight: "18px" }}>
              <span style={{ color: "var(--color-text-secondary)" }}>margen</span>
              <span>
                {formatPct(margen(uno.precioActual, uno.costoActual), false)} <span aria-hidden="true">→</span>
                <span className="sr-only"> pasa a </span>{" "}
                <span style={{ fontWeight: 500, color: "var(--color-success-text)" }}>{formatPct(uno.margenResultante, false)}</span>
              </span>
            </p>
            {uno.superaTopeSuba && (
              <p className="field-error" style={{ marginTop: 10 }}>
                <Icon name="warning" size={14} />
                La suba supera el tope de aumento que usamos como referencia.
              </p>
            )}
          </>
        ) : (
          <ul className="num" style={{ display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0, listStyle: "none", fontSize: 13, lineHeight: "18px" }}>
            {porConfirmar?.map((item) => (
              <li key={item.productoID} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{item.nombre}</span>
                <span style={{ whiteSpace: "nowrap" }}>
                  {formatMoneda(item.precioActual)} <span aria-hidden="true">→</span>
                  <span className="sr-only"> pasa a </span>{" "}
                  <span style={{ fontWeight: 500, color: "var(--color-accent-dark)" }}>{formatMoneda(item.precioSugerido)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="field-help" style={{ marginTop: 14 }}>
          {uno ? "El nuevo precio se usa" : "Los nuevos precios se usan"} desde ahora en tus reportes y sugerencias. Vas a poder
          deshacerlo durante unos segundos.
        </p>
      </ConfirmDialog>
    </AppLayout>
  );
}
