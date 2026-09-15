"use client";

// InvoiceTable — tabla de ítems extraídos por IA, edición inline
// Diseño según wireframe: ícono categoría + producto + tags, cantidad centrada,
// badge Estado AI, lápiz edición, fila colapsada, IVA/total pie.

export interface InvoiceItem {
  id: string;
  product: string;
  tags: string[];           // subcategorías bajo el nombre
  quantity: number;
  unitPrice: number;
  confidence: "alta" | "media" | "baja" | "verificado";
}

interface Props {
  items: InvoiceItem[];
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onItemChange: (id: string, field: "product" | "quantity" | "unitPrice", value: string | number) => void;
}

// ── Styles ────────────────────────────────────────────────────────────────

const iconStyle: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "15px",
  lineHeight: 1,
  userSelect: "none",
};

const CONF_BADGE: Record<
  InvoiceItem["confidence"],
  { bg: string; text: string; label: string }
> = {
  alta:       { bg: "var(--color-success-bg)",  text: "var(--color-success-text)", label: "✓ Alta" },
  media:      { bg: "var(--color-neutral-bg)",  text: "var(--color-neutral-text)", label: "✓ Media" },
  baja:       { bg: "var(--color-warning-bg)",  text: "var(--color-warning-text)", label: "⚠ Baja" },
  verificado: { bg: "var(--color-neutral-bg)",  text: "var(--color-neutral-text)", label: "✓ Verificado" },
};

function formatARS(value: number) {
  return "$" + value.toLocaleString("es-AR");
}

const thStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--color-text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  padding: "8px 10px",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const inputStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--color-text-primary)",
  backgroundColor: "var(--color-surface-input)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "var(--radius-sm)",
  padding: "3px 6px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

// ── Component ─────────────────────────────────────────────────────────────

export default function InvoiceTable({ items, editingId, onEdit, onItemChange }: Props) {
  // Show only first 3 rows collapsed, rest expanded on click
  const PREVIEW_COUNT = 3;
  const [expanded, setExpanded] = React.useState(false);
  const visibleItems = expanded ? items : items.slice(0, PREVIEW_COUNT);
  const hiddenCount = items.length - PREVIEW_COUNT;

  const grandTotal = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  const iva = Math.round(grandTotal * 0.21);
  const percepciones = Math.round(grandTotal * 0.03);

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        marginBottom: "20px",
      }}
    >
      {/* ── Table header bar ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary)" }}>
            Líneas de factura desglosadas
          </span>
          <span
            style={{
              backgroundColor: "var(--color-neutral-bg)",
              color: "var(--color-neutral-text)",
              fontSize: "11px",
              fontWeight: 500,
              padding: "1px 7px",
              borderRadius: "var(--radius-full)",
            }}
          >
            {items.length} ítems
          </span>
        </div>
      </div>

      {/* ── Column headers ───────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2.5fr 70px 120px 110px 95px 40px",
          backgroundColor: "var(--color-bg)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <span style={thStyle}>Producto / Insumo</span>
        <span style={{ ...thStyle, textAlign: "center" }}>Cantidad</span>
        <span style={{ ...thStyle, textAlign: "right" }}>Precio unitario</span>
        <span style={{ ...thStyle, textAlign: "right" }}>Subtotal</span>
        <span style={{ ...thStyle, textAlign: "center" }}>Estado AI</span>
        <span style={{ ...thStyle }}></span>
      </div>

      {/* ── Rows ─────────────────────────────────────────────────────── */}
      {visibleItems.map((item) => {
        const isEditing = editingId === item.id;
        const conf = CONF_BADGE[item.confidence];
        const subtotal = item.quantity * item.unitPrice;

        return (
          <div
            key={item.id}
            style={{
              display: "grid",
              gridTemplateColumns: "2.5fr 70px 120px 110px 95px 40px",
              alignItems: "center",
              borderTop: "1px solid var(--color-border-subtle)",
              backgroundColor: isEditing ? "#FFFAF6" : "var(--color-surface)",
              transition: "background-color 0.12s",
            }}
          >
            {/* Product column: name + tags */}
            <div style={{ padding: "10px 10px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {isEditing ? (
                  <input
                    type="text"
                    value={item.product}
                    onChange={(e) => onItemChange(item.id, "product", e.target.value)}
                    style={inputStyle}
                  />
                ) : (
                  <p style={{ fontSize: "13px", color: "var(--color-text-primary)", margin: "0 0 2px", fontWeight: 400 }}>
                    {item.product}
                  </p>
                )}
                {!isEditing && item.tags.length > 0 && (
                  <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>
                    {item.tags.join(" • ")}
                  </p>
                )}
              </div>
            </div>

            {/* Quantity */}
            <div style={{ padding: "10px 6px", textAlign: "center" }}>
              {isEditing ? (
                <input
                  type="number"
                  value={item.quantity}
                  min={1}
                  onChange={(e) => onItemChange(item.id, "quantity", Number(e.target.value))}
                  style={{ ...inputStyle, textAlign: "center", width: "50px" }}
                />
              ) : (
                <span
                  style={{
                    display: "inline-block",
                    minWidth: "28px",
                    padding: "2px 8px",
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                    textAlign: "center",
                  }}
                >
                  {item.quantity}
                </span>
              )}
            </div>

            {/* Unit price */}
            <div style={{ padding: "10px 10px", textAlign: "right" }}>
              {isEditing ? (
                <input
                  type="number"
                  value={item.unitPrice}
                  min={0}
                  onChange={(e) => onItemChange(item.id, "unitPrice", Number(e.target.value))}
                  style={{ ...inputStyle, textAlign: "right", width: "90px" }}
                />
              ) : (
                <span style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                  {formatARS(item.unitPrice)}
                </span>
              )}
            </div>

            {/* Subtotal — always computed */}
            <div style={{ padding: "10px 10px", textAlign: "right" }}>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                {formatARS(subtotal)}
              </span>
            </div>

            {/* Confidence badge */}
            <div style={{ padding: "10px 6px", textAlign: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  backgroundColor: conf.bg,
                  color: conf.text,
                  fontSize: "10px",
                  fontWeight: 500,
                  padding: "2px 7px",
                  borderRadius: "var(--radius-full)",
                  whiteSpace: "nowrap",
                }}
              >
                {conf.label}
              </span>
            </div>

            {/* Edit action */}
            <div style={{ padding: "10px 8px", textAlign: "center" }}>
              <button
                type="button"
                id={"invoice-edit-" + item.id}
                title={isEditing ? "Guardar cambios" : "Editar fila"}
                onClick={() => onEdit(isEditing ? null : item.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  display: "inline-flex",
                  alignItems: "center",
                  color: isEditing ? "var(--color-accent)" : "var(--color-text-muted)",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => { if (!isEditing) e.currentTarget.style.color = "var(--color-text-primary)"; }}
                onMouseLeave={(e) => { if (!isEditing) e.currentTarget.style.color = "var(--color-text-muted)"; }}
              >
                <span style={iconStyle}>{isEditing ? "check" : "edit"}</span>
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Collapsed row ─────────────────────────────────────────────── */}
      {!expanded && hiddenCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            borderTop: "1px solid var(--color-border-subtle)",
            backgroundColor: "var(--color-surface)",
          }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--color-accent)", flexShrink: 0, display: "inline-block" }} />
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
            +{hiddenCount} productos más
          </span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              color: "var(--color-accent)",
              fontWeight: 500,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            Desplegar todos
            <span style={{ ...iconStyle, fontSize: "13px" }}>expand_more</span>
          </button>
        </div>
      )}

      {/* ── IVA / Percepciones row ───────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          padding: "10px 14px",
          borderTop: "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg)",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
          IVA (21%): <strong style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{formatARS(iva)}</strong>
        </span>
        <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
          Percepciones: <strong style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{formatARS(percepciones)}</strong>
        </span>
        <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
          Condición: <strong style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>Cuenta Corriente 15d</strong>
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Total factura
        </span>
        <span style={{ fontSize: "20px", fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
          {formatARS(grandTotal)}
        </span>
      </div>
    </div>
  );
}

// React needs to be in scope for useState
import React from "react";
