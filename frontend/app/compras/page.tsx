"use client";

import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import PageHeader from "../../src/src/components/ui/PageHeader";
import KpiCard from "../../src/src/components/ui/KpiCard";
import Badge, { type BadgeTone } from "../../src/src/components/ui/Badge";
import Button from "../../src/src/components/ui/Button";
import Icon from "../../src/src/components/ui/Icon";
import Segmented from "../../src/src/components/ui/Segmented";
import { SkeletonRows } from "../../src/src/components/ui/Skeleton";
import { useToast } from "../../src/src/components/ui/Toast";
import { formatMoneda } from "../../lib/formato";
import { obtenerTokenAuth } from "../../lib/token";
import { ErrorApi, SesionVencida, mensajeDeError } from "../../lib/errores";
import { COMPRAS_URL, leerPagina, mapInvoices, type Invoice, type InvoiceStatus, type Resumen } from "../../lib/compras";
import FiltrosHistorial, { FILTROS_VACIOS, type FiltrosGastos } from "./FiltrosHistorial";
import DesgloseFactura from "./DesgloseFactura";

type StatusFilter = InvoiceStatus | "todos";

/** Lo que se le pide al backend: los filtros de búsqueda y el estado elegido. */
interface Consulta {
  filtros: FiltrosGastos;
  estado: StatusFilter;
}

const PAGE_SIZE = 10;

const STATUS_TONE: Record<InvoiceStatus, BadgeTone> = { procesada: "success", revisar: "warning", procesando: "neutral" };

const GRID = "minmax(0, 2fr) 96px minmax(0, 2.5fr) 104px 104px 112px";

const tableHeader: React.CSSProperties = { fontSize: 12, lineHeight: "16px", fontWeight: 500, color: "var(--color-text-secondary)" };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// ── Helpers ───────────────────────────────────────────────────────────────

/** "2026-11-10" → "10/11/2026". Si no es una fecha ISO, devuelve el texto tal cual. */
function formatFecha(fecha: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha || "sin fecha";
}

function exportarCsv(invoices: Invoice[]) {
  const celda = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const filas = [
    ["Proveedor", "Fecha", "Ítems", "Detalle", "Monto", "Estado"],
    ...invoices.map((i) => [i.provider, formatFecha(i.date), i.items, i.itemsDetail, i.total, i.status]),
  ];
  // BOM + punto y coma: así Excel en español lo abre bien con doble clic
  const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `compras-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ComprasPage() {
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [filtros, setFiltros] = useState<FiltrosGastos>(FILTROS_VACIOS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [hayFiltrosAplicados, setHayFiltrosAplicados] = useState(false);
  // Paginación del backend: la página que se ve y si hay otra después
  const [pagina, setPagina] = useState(0);
  const [haySiguiente, setHaySiguiente] = useState(false);
  // cursores[i] es el cursor con el que se pide la página i (la primera no lleva)
  const cursores = useRef<(string | null)[]>([null]);
  const ultimaBusqueda = useRef(0);
  const ultimaConsulta = useRef<Consulta>({ filtros: FILTROS_VACIOS, estado: "todos" });
  const ultimaPagina = useRef(0);

  // Trae una página de gastos del backend, que también filtra por proveedor, fechas y estado
  const cargarPagina = useCallback(async (consulta: Consulta, indice: number) => {
    const busquedaId = ++ultimaBusqueda.current;
    ultimaConsulta.current = consulta;
    ultimaPagina.current = indice;
    setIsLoading(true);
    setFetchError(false);

    const { filtros: f, estado } = consulta;
    const params = new URLSearchParams();
    if (f.proveedor) params.set("proveedor", f.proveedor);
    if (f.desde) params.set("desde", f.desde);
    if (f.hasta) params.set("hasta", f.hasta);
    if (estado !== "todos") params.set("estado", estado);
    const hayFiltrosEnConsulta = params.toString() !== "";
    params.set("limite", String(PAGE_SIZE));
    const cursor = cursores.current[indice];
    if (cursor) params.set("cursor", cursor);

    try {
      const token = await obtenerTokenAuth();
      if (!token) throw new SesionVencida();

      const response = await fetch(`${COMPRAS_URL}?${params}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new ErrorApi(response.status);

      const data = leerPagina(await response.json());
      if (busquedaId !== ultimaBusqueda.current) return; // llegó una búsqueda más nueva

      cursores.current = [...cursores.current.slice(0, indice + 1), data.siguiente];
      setInvoices(mapInvoices(data.gastos));
      setPagina(indice);
      setHaySiguiente(data.siguiente !== null);
      setHayFiltrosAplicados(hayFiltrosEnConsulta);
      setExpandedId(null);
      // Los KPIs los calcula el backend sobre todo el historial; vienen solo con la primera página
      if (data.resumen) setResumen(data.resumen);
    } catch (error) {
      if (busquedaId !== ultimaBusqueda.current) return;
      toast({ tone: "error", message: mensajeDeError(error, "cargar tus compras") });
      setInvoices([]);
      setFetchError(true);
    } finally {
      if (busquedaId === ultimaBusqueda.current) setIsLoading(false);
    }
  }, [toast]);

  /** Búsqueda nueva: vuelve a la primera página. */
  const buscar = useCallback(
    (consulta: Consulta) => {
      cursores.current = [null];
      cargarPagina(consulta, 0);
    },
    [cargarPagina]
  );

  // Carga inicial. ?estado=revisar es el atajo del dashboard
  useEffect(() => {
    const estado = new URLSearchParams(window.location.search).get("estado");
    const inicial: StatusFilter = estado === "revisar" || estado === "procesada" || estado === "procesando" ? estado : "todos";
    setStatusFilter(inicial);
    buscar({ filtros: FILTROS_VACIOS, estado: inicial });
  }, [buscar]);

  // ?subida=ok: llegada después de subir una factura
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subida") === "ok") {
      const archivo = params.get("archivo");
      toast({ message: archivo ? <>Factura subida: <strong>{archivo}</strong></> : "Factura subida" });
      window.history.replaceState(null, "", "/compras"); // así no reaparece al recargar
    }
  }, [toast]);

  function cambiarEstado(estado: StatusFilter) {
    setStatusFilter(estado);
    buscar({ filtros: ultimaConsulta.current.filtros, estado });
  }

  function buscarConFiltros(f: FiltrosGastos) {
    buscar({ filtros: f, estado: statusFilter });
  }

  function borrarFiltros() {
    setFiltros(FILTROS_VACIOS);
    setStatusFilter("todos");
    if (hayFiltrosAplicados || filtros.proveedor || filtros.desde || filtros.hasta) {
      buscar({ filtros: FILTROS_VACIOS, estado: "todos" });
    }
  }

  // Todos los filtros los aplica el backend: `invoices` ya es la página a mostrar
  const shown = invoices;
  const hayFiltros = hayFiltrosAplicados || statusFilter !== "todos";
  const sinFacturas = !isLoading && !fetchError && invoices.length === 0 && !hayFiltrosAplicados && pagina === 0;

  const mesActual = MESES[new Date().getMonth()];

  return (
    <AppLayout activeTab="compras">
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <PageHeader title="Historial de compras" subtitle="Todas tus facturas. La IA marca las que conviene revisar." />

        {/* ── KPIs ─────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          <KpiCard
            label={`Total de compras de ${mesActual}`}
            value={resumen ? formatMoneda(resumen.totalMes) : "—"}
            loading={!resumen && isLoading}
            footer={
              resumen &&
              (resumen.facturasMes === 0
                ? "todavía no hay facturas este mes"
                : `${resumen.facturasMes === 1 ? "1 factura" : `${resumen.facturasMes} facturas`}${
                    resumen.variacion != null
                      ? ` · ${resumen.variacion > 0 ? "+" : "−"}${Math.abs(resumen.variacion).toFixed(1).replace(".", ",")}% vs. el mes anterior`
                      : ""
                  }`)
            }
          />
          <KpiCard
            id="kpi-por-revisar"
            label="Facturas por revisar"
            value={resumen ? resumen.porRevisar : "—"}
            loading={!resumen && isLoading}
            isAlert={!!resumen && resumen.porRevisar > 0}
            onClick={resumen && resumen.porRevisar > 0 ? () => cambiarEstado("revisar") : undefined}
            footer={
              resumen && resumen.porRevisar > 0 ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 500, color: "var(--color-accent-dark)" }}>
                  ver solo estas
                  <Icon name="chevron_right" size={14} />
                </span>
              ) : (
                resumen && "no hay facturas pendientes"
              )
            }
          />
          {/* MOCK TEMPORAL: la API todavía no informa los sobreprecios detectados */}
          <KpiCard
            label="Sobreprecios detectados"
            ia
            value="$38.200"
            footer="manteca y grasa bovina, +8,6% sobre tu precio habitual"
          />
        </div>

        {/* ── Tabla ────────────────────────────────────────────────────── */}
        <section className="card" aria-label="facturas">
          {/* Una sola barra de filtros */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--color-border)", flexWrap: "wrap" }}>
            <FiltrosHistorial filtros={filtros} onChange={setFiltros} onBuscar={buscarConFiltros} />
            <Segmented
              label="estado de la factura"
              value={statusFilter}
              onChange={cambiarEstado}
              options={[
                { value: "todos", label: "todas" },
                { value: "revisar", label: "por revisar", count: resumen?.porRevisar },
                { value: "procesada", label: "procesadas" },
                { value: "procesando", label: "procesando" },
              ]}
            />
            <span style={{ flex: 1 }} />
            <Button
              id="btn-borrar-filtros"
              size="sm"
              icon="filter_alt_off"
              disabled={!hayFiltros && !filtros.proveedor && !filtros.desde && !filtros.hasta}
              onClick={borrarFiltros}
            >
              Borrar filtros
            </Button>
            <Button id="btn-exportar-csv" size="sm" icon="download" disabled={invoices.length === 0} onClick={() => exportarCsv(invoices)}>
              exportar CSV
            </Button>
          </div>

          <div role="table" aria-label="facturas" aria-busy={isLoading}>
            <div role="row" style={{ display: "grid", gridTemplateColumns: GRID, columnGap: 16, padding: "10px 16px", borderBottom: "1px solid var(--color-border)" }}>
              <span role="columnheader" style={tableHeader}>Proveedor</span>
              <span role="columnheader" style={tableHeader}>Fecha</span>
              <span role="columnheader" style={tableHeader}>Detalle</span>
              <span role="columnheader" style={{ ...tableHeader, textAlign: "right" }}>Monto</span>
              <span role="columnheader" style={tableHeader}>Estado</span>
              <span role="columnheader" style={tableHeader}><span className="sr-only">Acción</span></span>
            </div>

            {isLoading ? (
              <SkeletonRows rows={5} label="Cargando compras" />
            ) : fetchError ? (
              <div className="empty-state" role="alert">
                <span style={{ display: "flex", color: "var(--color-warning-text)" }}><Icon name="wifi_off" size={24} /></span>
                <p>No pudimos cargar tus compras. Revisá tu conexión y probá de nuevo.</p>
                <Button variant="warning" size="sm" icon="refresh" onClick={() => cargarPagina(ultimaConsulta.current, ultimaPagina.current)}>
                  reintentar
                </Button>
              </div>
            ) : sinFacturas ? (
              <div className="empty-state">
                <span style={{ display: "flex", color: "var(--color-icon-brand)" }}><Icon name="receipt_long" size={24} /></span>
                <p>Todavía no cargaste ninguna factura. Subí la primera y la IA lee el proveedor, los ítems y los totales.</p>
                <Button variant="primary" size="sm" icon="upload_file" href="/compras/subir">
                  subir tu primera factura
                </Button>
              </div>
            ) : invoices.length === 0 ? (
              <div className="empty-state">
                <p>{pagina > 0 ? "No hay más facturas." : "No hay facturas con esos filtros."}</p>
                <Button size="sm" icon="filter_alt_off" onClick={borrarFiltros}>
                  Borrar filtros
                </Button>
              </div>
            ) : (
              shown.map((inv, idx) => {
                const abrirDesglose = () => setExpandedId(inv.id);
                return (
                  <Fragment key={inv.id}>
                    <div
                      role="row"
                      style={{
                        display: "grid",
                        gridTemplateColumns: GRID,
                        columnGap: 16,
                        padding: "12px 16px",
                        alignItems: "center",
                        borderTop: idx > 0 ? "1px solid var(--color-border-subtle)" : "none",
                        backgroundColor: inv.status === "revisar" ? "var(--color-surface-flag)" : "transparent",
                      }}
                    >
                      <span role="cell" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>{inv.provider}</span>
                      <span role="cell" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{formatFecha(inv.date)}</span>
                      <div role="cell" style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {inv.items === 1 ? "1 ítem" : `${inv.items} ítems`} · {inv.itemsDetail}
                        </p>
                        {inv.alert && (
                          <p style={{ fontSize: 12, lineHeight: "16px", color: "var(--color-warning-text)", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                            <Icon name="warning" size={14} />
                            {inv.alert}
                          </p>
                        )}
                      </div>
                      <span role="cell" className="num" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{formatMoneda(inv.total)}</span>
                      <span role="cell"><Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>{inv.status}</Badge></span>
                      <span role="cell" style={{ textAlign: "right" }}>
                        {inv.status === "procesando" ? (
                          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>leyendo…</span>
                        ) : inv.status === "revisar" ? (
                          <Button id={"btn-revisar-" + inv.id} variant="warning" size="sm" aria-haspopup="dialog" onClick={abrirDesglose}>
                            revisar
                          </Button>
                        ) : inv.itemList.length > 0 ? (
                          <Button id={"btn-desglose-" + inv.id} variant="text" size="sm" iconEnd="chevron_right" aria-haspopup="dialog" onClick={abrirDesglose}>
                            Ver desglose
                          </Button>
                        ) : null}
                      </span>
                    </div>
                  </Fragment>
                );
              })
            )}
          </div>

          {!fetchError && (pagina > 0 || haySiguiente) && (
            <nav aria-label="paginación de facturas" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }} aria-live="polite">
                página {pagina + 1}
                {hayFiltros && " · con estos filtros"}
              </span>
              <span style={{ display: "flex", gap: 8 }}>
                <Button id="btn-pagina-anterior" size="sm" icon="chevron_left" disabled={isLoading || pagina === 0} onClick={() => cargarPagina(ultimaConsulta.current, pagina - 1)}>
                  Anterior
                </Button>
                <Button id="btn-pagina-siguiente" size="sm" iconEnd="chevron_right" disabled={isLoading || !haySiguiente} onClick={() => cargarPagina(ultimaConsulta.current, pagina + 1)}>
                  Siguiente
                </Button>
              </span>
            </nav>
          )}
        </section>
      </div>

      {/* expandedId es la factura con el modal de desglose abierto */}
      <DesgloseFactura
        factura={invoices.find((i) => i.id === expandedId) ?? null}
        formatearFecha={formatFecha}
        onClose={() => setExpandedId(null)}
      />
    </AppLayout>
  );
}
