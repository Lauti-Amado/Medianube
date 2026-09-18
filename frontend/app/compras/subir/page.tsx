"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AppLayout from "../../../src/src/components/layout/AppLayout";
import IaBanner from "../../../src/src/components/invoices/IaBanner";
import InvoiceTable, { InvoiceItem } from "../../../src/src/components/invoices/InvoiceTable";

// ── Mock data ─────────────────────────────────────────────────────────────

const INITIAL_ITEMS: InvoiceItem[] = [
  { id: "i1", product: "Harina 000 x 25 kg",       tags: ["Molino Cañuelas", "Bolsa papel"],    quantity: 4,  unitPrice: 8200,  confidence: "alta" },
  { id: "i2", product: "Manteca x 5 kg",            tags: ["La Serenísima", "Bloque industrial"], quantity: 2,  unitPrice: 6450,  confidence: "alta" },
  { id: "i3", product: "Levadura fresca x 500 g",   tags: ["Calsa prensada", "Panificación"],    quantity: 6,  unitPrice: 1070,  confidence: "verificado" },
  { id: "i4", product: "Azúcar común x 50 kg",      tags: ["Ledesma", "Bolsa tela"],             quantity: 2,  unitPrice: 12400, confidence: "alta" },
  { id: "i5", product: "Esencia de vainilla 500 ml", tags: ["Balbi", "Aromas naturales"],        quantity: 3,  unitPrice: 1850,  confidence: "media" },
  { id: "i6", product: "Sal fina x 25 kg",          tags: ["Dos Anclas", "Yodada"],              quantity: 1,  unitPrice: 2900,  confidence: "alta" },
  { id: "i7", product: "Dulce de leche repostero 4 kg", tags: ["La Serenísima", "Horneado"],    quantity: 4,  unitPrice: 4300,  confidence: "alta" },
  { id: "i8", product: "Grasa refinada x 5 kg",     tags: ["Frigorífico regional", "Panadería"],quantity: 2,  unitPrice: 3200,  confidence: "baja" },
];

const iconStyle: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "14px",
  lineHeight: 1,
  userSelect: "none",
};

// ── Page ─────────────────────────────────────────────────────────────────

export default function SubirFacturaPage() {
  const router = useRouter();
  const [items, setItems] = useState<InvoiceItem[]>(INITIAL_ITEMS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fileRemoved, setFileRemoved] = useState(false);

  const total = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  const totalFormatted = "$" + total.toLocaleString("es-AR");

  function handleItemChange(id: string, field: "product" | "quantity" | "unitPrice", value: string | number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  return (
    <AppLayout activeTab="compras">
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>

        {/* ── Back link ─────────────────────────────────────────────── */}
        <Link
          href="/compras"
          id="back-to-compras"
          style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            fontSize: "12px", color: "var(--color-text-secondary)", textDecoration: "none",
            marginBottom: "14px", transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; }}
        >
          <span style={iconStyle}>arrow_back</span>
          volver a compras
        </Link>

        {/* ── Page title ────────────────────────────────────────────── */}
        <h1 style={{ fontSize: "20px", fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 16px", letterSpacing: "-0.01em" }}>
          Subir factura
        </h1>

        {/* ── Two-column: File card + Supplier detected ─────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", marginBottom: "12px" }}>

          {/* File card */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "12px 14px",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <span style={{ ...iconStyle, fontSize: "22px", color: "var(--color-accent)", flexShrink: 0 }}>description</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {!fileRemoved ? (
                <>
                  <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    factura_distribuidora-sur_04-09.pdf
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>312 KB</p>
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "11px", color: "var(--color-success-text)" }}>
                      <span style={{ ...iconStyle, fontSize: "12px" }}>check_circle</span>
                      Procesado en 1.4s
                    </span>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: "13px", color: "var(--color-warning-text)", margin: 0 }}>
                  Archivo quitado.{" "}
                  <button type="button" onClick={() => setFileRemoved(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-accent)", fontSize: "13px", padding: 0, fontWeight: 500 }}>
                    Deshacer
                  </button>
                </p>
              )}
            </div>
            {!fileRemoved && (
              <button
                type="button"
                onClick={() => setFileRemoved(true)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "var(--color-text-muted)", padding: "4px", flexShrink: 0, transition: "color 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-warning-text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
              >
                <span style={{ ...iconStyle, fontSize: "13px" }}>close</span>
                Quitar
              </button>
            )}
          </div>

          {/* Supplier detected card */}
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              minWidth: "200px",
            }}
          >
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 4px" }}>
              Distribuidora detectada
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
                Distribuidora Sur S.A.
              </p>
              <span style={{ backgroundColor: "var(--color-success-bg)", color: "var(--color-success-text)", fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}>
                99% coincidencia
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>
              CUIT 30-71449821-4
            </p>
          </div>
        </div>

        {/* ── IA Banner ────────────────────────────────────────────────── */}
        <IaBanner productCount={items.length} total={totalFormatted} confidence="alta" />

        {/* ── Editable invoice table ───────────────────────────────────── */}
        <InvoiceTable
          items={items}
          editingId={editingId}
          onEdit={setEditingId}
          onItemChange={handleItemChange}
        />

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            id="invoice-cancel"
            type="button"
            onClick={() => router.push("/compras")}
            style={{
              padding: "9px 20px", fontSize: "13px", fontWeight: 500,
              backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)", color: "var(--color-text-primary)", cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-border-strong)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
          >
            Cancelar
          </button>
          <button
            id="invoice-confirm"
            type="button"
            onClick={() => router.push("/compras")}
            style={{
              padding: "9px 20px", fontSize: "13px", fontWeight: 500,
              backgroundColor: "var(--color-accent)", border: "none",
              borderRadius: "var(--radius-md)", color: "#FFFFFF", cursor: "pointer",
              transition: "background-color 0.15s",
              display: "inline-flex", alignItems: "center", gap: "7px",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-accent-dark)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-accent)"; }}
          >
            <span style={{ ...iconStyle, fontSize: "15px" }}>check_circle</span>
            Confirmar y guardar
          </button>
        </div>

      </div>
    </AppLayout>
  );
}
