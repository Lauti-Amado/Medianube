"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import FiltrosHistorial, { FILTROS_VACIOS, type FiltrosGastos } from "./FiltrosHistorial";

type InvoiceStatus = "procesada" | "revisar" | "procesando";

interface Invoice {
  id: string;
  provider: string;
  date: string;
  items: number;
  itemsDetail: string;
  total: number;
  status: InvoiceStatus;
  alert?: string;
}

// Forma de cada gasto que devuelve el endpoint /compras (campos opcionales por mapeo defensivo)
interface GastoApi {
  gastoID?: string;
  proveedor?: string;
  fecha?: string;
  monto?: number | string;
  categoria?: string;
  usuarioID?: string;
  descripcion?: string;
  cantidadItems?: number;
  items?: { descripcion?: string }[];
  estado?: string;
  alerta?: string;
}

const fmt = (n: number) => "$" + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

const STATUS_LABEL: Record<InvoiceStatus, string> = { procesada: "Procesada", revisar: "Revisar", procesando: "Procesando" };

const STATUS_STYLE: Record<InvoiceStatus, React.CSSProperties> = {
  procesada: { backgroundColor: "var(--color-success-bg)", color: "var(--color-success-text)" },
  revisar: { backgroundColor: "var(--color-warning-bg)", color: "var(--color-warning-text)" },
  procesando: { backgroundColor: "var(--color-neutral-bg)", color: "var(--color-neutral-text)" },
};

const icon: React.CSSProperties = { fontFamily: "Material Symbols Outlined", fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20", fontSize: "14px", lineHeight: 1, userSelect: "none" };

const KPIS = [
  { label: "Total compras del mes", value: "$1.284.600", meta: "32 comprobantes contabilizados", badge: { text: "+4.2% vs ago", warning: false }, icon: "calendar_month" },
  { label: "Facturas por revisar", value: "3", meta: "Discrepancias o ítems nuevos", badge: { text: "Acción requerida", warning: true }, icon: "notifications" },
  { label: "Sobreprecios detectados por IA", value: "$38.200", meta: "Harina 000 y Grasa bovina", badge: { text: "Desvío medio +8.6%", warning: true }, icon: "query_stats" },
];

export default function ComprasPage() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "todos">("todos");
  
  // 1. Estados para la integración con el backend (de la rama feat)
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // 2. Estado para el cartel de éxito (de la rama main)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  // 3. Estados de los filtros de búsqueda contra el backend
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hayFiltrosAplicados, setHayFiltrosAplicados] = useState(false);
  const ultimaBusqueda = useRef(0);

  // Trae los gastos del backend, agregando solo los filtros completos
  const fetchHistorial = useCallback(async (filtros: FiltrosGastos = FILTROS_VACIOS) => {
      const busquedaId = ++ultimaBusqueda.current;
      setIsLoading(true);
      setFetchError(null);

      const params = new URLSearchParams();
      if (filtros.proveedor) params.set("proveedor", filtros.proveedor);
      if (filtros.desde) params.set("desde", filtros.desde);
      if (filtros.hasta) params.set("hasta", filtros.hasta);
      const query = params.toString();

      try {
        const urlEndpoint = "https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com/compras";

        const response = await fetch(query ? `${urlEndpoint}?${query}` : urlEndpoint, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) {
          // El backend responde { error } en los 400 (ej: fecha con mal formato)
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || `Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        if (busquedaId !== ultimaBusqueda.current) return; // llegó una búsqueda más nueva

        // --- DEPURACIÓN Y VALIDACIÓN ---
        console.log("Respuesta cruda de la API:", data);

        let parsedData: GastoApi[] = [];

        if (data && data.gastos && Array.isArray(data.gastos)) {
           parsedData = data.gastos;
        } else if (Array.isArray(data)) {
          parsedData = data;
        }

        // Mapeo defensivo
        const mappedInvoices: Invoice[] = parsedData.map((item: GastoApi, index: number) => {

            let itemsCount = 0;
            let detailText = "Sin detalle";

            if (item.items && Array.isArray(item.items)) {
                itemsCount = item.items.length;
                detailText = item.items.map((i) => i.descripcion).filter(Boolean).join(", ");
            } else {
                itemsCount = item.cantidadItems || 1;
                detailText = item.categoria || item.descripcion || "Insumos varios";
            }

            return {
                id: item.gastoID || `temp-id-${index}`,
                provider: item.proveedor || "Proveedor Desconocido",
                date: item.fecha || "Fecha desconocida",
                items: itemsCount,
                itemsDetail: detailText,
                total: Number(item.monto) || 0,
                status: (item.estado || "procesada") as InvoiceStatus,
                alert: item.alerta || undefined
            };
        });

        setInvoices(mappedInvoices);
        setHayFiltrosAplicados(query !== "");

      } catch (error) {
        if (busquedaId !== ultimaBusqueda.current) return;
        console.error("Error en la integración:", error);
        setInvoices([]);
        setFetchError(error instanceof Error ? error.message : "Error desconocido");
      } finally {
        if (busquedaId === ultimaBusqueda.current) setIsLoading(false);
      }
  }, []);

  // Efecto A: Cargar los datos desde el backend
  useEffect(() => {
    setIsClient(true);
    fetchHistorial();
  }, [fetchHistorial]);

  // Efecto B: Manejar el cartel de éxito si venimos de subir una factura
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subida") !== "ok") return;
    setUploadedFile(params.get("archivo") ?? "");
    window.history.replaceState(null, "", "/compras"); // así no reaparece al recargar
    const timer = setTimeout(() => setUploadedFile(null), 4000);
    return () => clearTimeout(timer);
  }, []);

  // Evitamos renderizar lógica compleja en el servidor antes del montaje del cliente
  if (!isClient) {
     return <AppLayout activeTab="compras"><div style={{ padding: "40px", textAlign: "center" }}>Cargando interfaz...</div></AppLayout>;
  }

  // Filtrado combinando la lógica segura (feat) apuntando al estado real (invoices)
  // La búsqueda por proveedor y fechas la hace el backend (FiltrosHistorial); acá solo se filtra por estado
  const filtered = invoices.filter((inv) => statusFilter === "todos" || inv.status === statusFilter);

  return (
    <AppLayout activeTab="compras">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* Cartel de éxito si uploadedFile no es nulo */}
        {uploadedFile !== null && (
          <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "var(--color-success-bg)", color: "var(--color-success-text)", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
            <span style={{ ...icon, fontSize: 16 }}>check_circle</span>
            <span style={{ flex: 1 }}>
              Factura subida correctamente{uploadedFile && <> · <strong style={{ fontWeight: 500 }}>{uploadedFile}</strong></>}
            </span>
            <button type="button" aria-label="cerrar" onClick={() => setUploadedFile(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex" }}>
              <span style={{ ...icon, fontSize: 16 }}>close</span>
            </button>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>Historial de compras</h1>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0" }}>Facturas procesadas y auditadas por IA</p>
          </div>
          <Link href="/compras/subir" style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "var(--color-accent)", color: "#fff", fontSize: 13, fontWeight: 500, padding: "9px 16px", borderRadius: 8, textDecoration: "none" }}>
            <span style={{ ...icon, fontSize: 15 }}>upload_file</span>
            Subir factura
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {KPIS.map((kpi) => (
            <div key={kpi.label} style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{kpi.label}</span>
                <span style={{ ...icon, fontSize: 16, color: "var(--color-text-muted)" }}>{kpi.icon}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 500, color: kpi.badge.warning ? "var(--color-warning-text)" : "var(--color-text-primary)", marginBottom: 6 }}>{kpi.value}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 6, backgroundColor: kpi.badge.warning ? "var(--color-warning-bg)" : "var(--color-success-bg)", color: kpi.badge.warning ? "var(--color-warning-text)" : "var(--color-success-text)" }}>{kpi.badge.text}</span>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{kpi.meta}</span>
              </div>
            </div>
          ))}
        </div>

        <FiltrosHistorial isLoading={isLoading} onBuscar={fetchHistorial} />

        <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--color-border)", flexWrap: "wrap" }}>
            <select id="filter-estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "todos")}
              style={{ fontSize: 13, border: "1px solid var(--color-border)", borderRadius: 8, backgroundColor: "var(--color-surface-input)", color: "var(--color-text-primary)", padding: "8px 10px", outline: "none", cursor: "pointer" }}>
              <option value="todos">Todos los estados</option>
              <option value="procesada">Procesada</option>
              <option value="revisar">Revisar</option>
              <option value="procesando">Procesando</option>
            </select>
            <button id="btn-exportar-csv" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--color-text-secondary)", backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
              <span style={{ ...icon }}>download</span>
              Exportar CSV
            </button>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginLeft: "auto" }}>Mostrando {filtered.length} facturas</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2.5fr 1fr 120px 90px", columnGap: 16, padding: "10px 16px", borderBottom: "1px solid var(--color-border)" }}>
            {["Proveedor", "Emisión", "Detalle insumos", "Monto total", "Estado", ""].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: h === "Monto total" ? "right" : "left" }}>{h}</span>
            ))}
          </div>

          {isLoading ? (
             <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "var(--color-text-muted)" }}>
               Cargando datos desde la nube...
             </div>
          ) : fetchError ? (
            <div role="alert" style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "var(--color-warning-text)" }}>
              No se pudieron cargar las compras: {fetchError}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "var(--color-text-muted)" }}>
              {hayFiltrosAplicados && invoices.length === 0 ? "No se encontraron compras con esos filtros" : "No hay facturas que coincidan."}
            </div>
          ) : (
            filtered.map((inv, idx) => (
              <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2.5fr 1fr 120px 90px", columnGap: 16, padding: "12px 16px", alignItems: "center", borderBottom: idx < filtered.length - 1 ? "1px solid #F5EBDF" : "none", backgroundColor: inv.status === "revisar" ? "rgba(247,227,221,0.25)" : "transparent" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{inv.provider}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{inv.date}</div>
                <div>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}><strong style={{ color: "var(--color-text-primary)", fontWeight: 400 }}>{inv.items} ítems</strong> · {inv.itemsDetail}</span>
                  {inv.alert && (
                    <div style={{ fontSize: 11, color: "var(--color-warning-text)", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ ...icon, fontSize: 12 }}>warning</span>{inv.alert}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", textAlign: "right" }}>{fmt(inv.total)}</div>
                <div><span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 500, ...STATUS_STYLE[inv.status] }}>{STATUS_LABEL[inv.status]}</span></div>
                <div style={{ textAlign: "right" }}>
                  {inv.status === "procesando" ? (
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Extrayendo…</span>
                  ) : inv.status === "revisar" ? (
                    <button id={"btn-auditar-" + inv.id} style={{ fontSize: 12, fontWeight: 500, color: "var(--color-warning-text)", backgroundColor: "transparent", border: "1px solid var(--color-warning-text)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ ...icon, fontSize: 12 }}>edit_note</span>Auditar
                    </button>
                  ) : (
                    <button id={"btn-desglose-" + inv.id} style={{ fontSize: 12, color: "var(--color-text-secondary)", backgroundColor: "transparent", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, padding: 0 }}>
                      Ver desglose<span style={{ ...icon, fontSize: 12 }}>chevron_right</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--color-border)" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Página 1 de 4 · Actualizado hace 4 min</span>
            <div style={{ display: "flex", gap: 4 }}>
              {["Anterior", "1", "2", "3", "4", "Siguiente"].map((p) => (
                <button key={p} style={{ fontSize: 12, padding: "4px 9px", borderRadius: 6, border: "1px solid var(--color-border)", backgroundColor: p === "1" ? "var(--color-accent)" : "transparent", color: p === "1" ? "#fff" : "var(--color-text-secondary)", cursor: "pointer", fontWeight: p === "1" ? 500 : 400 }}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}