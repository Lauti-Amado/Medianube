"use client";

import Link from "next/link";
import { useState } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";

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

const INVOICES: Invoice[] = [
  { id: "inv-1", provider: "Molino San Justo", date: "3 sep 2024", items: 6, itemsDetail: "Harina 000 (x50kg), Salvado fino, Semolín...", total: 412800, status: "procesada" },
  { id: "inv-2", provider: "Lácteos del Valle", date: "2 sep 2024", items: 9, itemsDetail: "Manteca extra x5kg, Leche entera 1L...", total: 186400, status: "procesada" },
  { id: "inv-3", provider: "Envases y Descartables SRL", date: "1 sep 2024", items: 14, itemsDetail: "Caja corrugada para medialunas", total: 94150, status: "revisar", alert: "+14.2% precio unitario cajas" },
  { id: "inv-4", provider: "Levadura y Aditivos SA", date: "30 ago 2024", items: 4, itemsDetail: "Levadura fresca prensada x500g, Extracto de malta...", total: 58900, status: "procesada" },
  { id: "inv-5", provider: "Cadena de Frío Express", date: "29 ago 2024", items: 7, itemsDetail: "Detectando ítems...", total: 132350, status: "procesando" },
  { id: "inv-6", provider: "Distribuidora Norte", date: "27 ago 2024", items: 5, itemsDetail: "Azúcar refinada x50kg, Sal gruesa...", total: 77200, status: "procesada" },
];

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "todos">("todos");

  const filtered = INVOICES.filter((inv) => {
    const matchesSearch = search === "" || inv.provider.toLowerCase().includes(search.toLowerCase()) || inv.itemsDetail.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "todos" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout activeTab="compras">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

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

        <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--color-border)", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <span style={{ ...icon, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }}>search</span>
              <input id="search-facturas" type="text" placeholder="Buscar por proveedor o ingrediente" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, border: "1px solid var(--color-border)", borderRadius: 8, backgroundColor: "var(--color-surface-input)", color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" }} />
            </div>
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
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginLeft: "auto" }}>Mostrando {filtered.length} de {INVOICES.length} facturas</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2.5fr 1fr 120px 90px", columnGap: 16, padding: "10px 16px", borderBottom: "1px solid var(--color-border)" }}>
            {["Proveedor", "Emisión", "Detalle insumos", "Monto total", "Estado", ""].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: h === "Monto total" ? "right" : "left" }}>{h}</span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "var(--color-text-muted)" }}>No hay facturas que coincidan.</div>
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