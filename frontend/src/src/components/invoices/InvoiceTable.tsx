"use client";

// InvoiceTable — ítems que la IA leyó de la factura, con el resumen de totales al pie.
// Muestra todos los ítems. La columna "confianza" y la edición aparecen solo cuando hay
// datos o handlers para respaldarlas: no se inventa confianza ni se ofrece editar algo
// que no se va a guardar.

import { formatMoneda } from "../../../../lib/formato";
import Badge, { type BadgeTone } from "../ui/Badge";
import Icon from "../ui/Icon";

export type Confianza = "alta" | "media" | "baja" | "verificado";

export interface InvoiceItem {
  id: string;
  product: string;
  tags: string[]; // subcategorías bajo el nombre
  quantity: number;
  unitPrice: number;
  /** Solo si el backend la informa. */
  confidence?: Confianza;
}

interface Props {
  items: InvoiceItem[];
  /** Total que figura en la factura. Si no coincide con la suma de ítems, se muestra la diferencia. */
  total?: number | null;
  /** Edición en línea: se habilita solo si se pasan los tres. */
  editingId?: string | null;
  onEdit?: (id: string | null) => void;
  onItemChange?: (id: string, field: "product" | "quantity" | "unitPrice", value: string | number) => void;
}

const CONF_TONE: Record<Confianza, BadgeTone> = {
  alta: "success",
  media: "neutral",
  baja: "warning",
  verificado: "neutral",
};

const th: React.CSSProperties = {
  fontSize: 12,
  lineHeight: "16px",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
  whiteSpace: "nowrap",
};

const cellInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "4px 8px",
  border: "1px solid var(--color-accent)",
  borderRadius: "var(--radius-sm)",
  backgroundColor: "var(--color-surface-input)",
  color: "var(--color-text-primary)",
  fontSize: 13,
  lineHeight: "18px",
};

export default function InvoiceTable({ items, total, editingId, onEdit, onItemChange }: Props) {
  const editable = Boolean(onEdit && onItemChange);
  const conConfianza = items.some((i) => i.confidence);

  const columns = ["minmax(0, 2.4fr)", "90px", "130px", "120px", conConfianza && "110px", editable && "32px"]
    .filter(Boolean)
    .join(" ");
  const row: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: columns,
    columnGap: 16,
    alignItems: "center",
    padding: "10px 16px",
  };

  const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  // Con menos de un peso de diferencia se considera que coinciden
  const diferencia = total != null ? total - subtotal : 0;
  const hayCargos = diferencia >= 1;
  const noCoincide = diferencia <= -1;

  return (
    <section id="invoice-items" className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
      <header className="card-header">
        <h2 className="card-title">
          Ítems de la factura
          <Badge>{items.length === 1 ? "1 ítem" : `${items.length} ítems`}</Badge>
        </h2>
      </header>

      <div style={{ overflowX: "auto" }}>
        <div role="table" aria-label="Ítems de la factura" style={{ minWidth: 620 }}>
          <div role="row" style={{ ...row, backgroundColor: "var(--color-bg)" }}>
            <span role="columnheader" style={th}>Producto</span>
            <span role="columnheader" style={{ ...th, textAlign: "center" }}>Cantidad</span>
            <span role="columnheader" style={{ ...th, textAlign: "right" }}>Precio unitario</span>
            <span role="columnheader" style={{ ...th, textAlign: "right" }}>Subtotal</span>
            {conConfianza && <span role="columnheader" style={{ ...th, textAlign: "center" }}>Confianza</span>}
            {editable && <span role="columnheader" className="sr-only">Editar</span>}
          </div>

          {items.map((item) => {
            const isEditing = editable && editingId === item.id;
            const revisar = item.confidence === "baja";

            return (
              <div
                key={item.id}
                role="row"
                style={{
                  ...row,
                  borderTop: "1px solid var(--color-border-subtle)",
                  backgroundColor: revisar ? "var(--color-surface-flag)" : undefined,
                }}
              >
                <div role="cell" style={{ minWidth: 0 }}>
                  {isEditing ? (
                    <input
                      type="text"
                      aria-label="producto"
                      value={item.product}
                      onChange={(e) => onItemChange?.(item.id, "product", e.target.value)}
                      style={cellInput}
                    />
                  ) : (
                    <p style={{ fontSize: 13, lineHeight: "18px", color: "var(--color-text-primary)", margin: 0, overflowWrap: "anywhere" }}>
                      {item.product}
                    </p>
                  )}
                  {revisar ? (
                    <p style={{ fontSize: 12, lineHeight: "16px", color: "var(--color-warning-text)", margin: "2px 0 0" }}>
                      la IA no está segura de esta fila: comparala con la factura
                    </p>
                  ) : (
                    !isEditing &&
                    item.tags.length > 0 && (
                      <p style={{ fontSize: 12, lineHeight: "16px", color: "var(--color-text-secondary)", margin: "2px 0 0" }}>
                        {item.tags.join(", ")}
                      </p>
                    )
                  )}
                </div>

                <div role="cell" style={{ textAlign: "center" }}>
                  {isEditing ? (
                    <input
                      type="number"
                      aria-label="cantidad"
                      value={item.quantity}
                      min={1}
                      onChange={(e) => onItemChange?.(item.id, "quantity", Number(e.target.value))}
                      style={{ ...cellInput, textAlign: "center" }}
                    />
                  ) : (
                    <span
                      className="num"
                      style={{
                        display: "inline-block",
                        minWidth: 30,
                        padding: "2px 8px",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--color-bg)",
                        fontSize: 13,
                        lineHeight: "18px",
                        fontWeight: 500,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {item.quantity}
                    </span>
                  )}
                </div>

                <div role="cell" className="num" style={{ textAlign: "right", fontSize: 13, color: "var(--color-text-primary)" }}>
                  {isEditing ? (
                    <input
                      type="number"
                      aria-label="precio unitario"
                      value={item.unitPrice}
                      min={0}
                      onChange={(e) => onItemChange?.(item.id, "unitPrice", Number(e.target.value))}
                      style={{ ...cellInput, textAlign: "right" }}
                    />
                  ) : (
                    formatMoneda(item.unitPrice)
                  )}
                </div>

                <div role="cell" className="num" style={{ textAlign: "right", fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                  {formatMoneda(item.quantity * item.unitPrice)}
                </div>

                {conConfianza && (
                  <div role="cell" style={{ textAlign: "center" }}>
                    {item.confidence && <Badge tone={CONF_TONE[item.confidence]}>{item.confidence}</Badge>}
                  </div>
                )}

                {editable && (
                  <div role="cell" style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      type="button"
                      id={"invoice-edit-" + item.id}
                      aria-label={isEditing ? `terminar de editar ${item.product}` : `editar ${item.product}`}
                      onClick={() => onEdit?.(isEditing ? null : item.id)}
                      style={{
                        display: "inline-flex",
                        padding: 4,
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        background: "none",
                        color: isEditing ? "var(--color-accent-dark)" : "var(--color-text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      <Icon name={isEditing ? "check" : "edit"} size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Totales a la derecha, como en una factura en papel */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "12px 24px",
          padding: "14px 16px",
          borderTop: "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg)",
        }}
      >
        <p style={{ flex: "1 1 240px", fontSize: 12, lineHeight: "17px", margin: 0, color: noCoincide ? "var(--color-warning-text)" : "var(--color-text-secondary)" }}>
          {noCoincide
            ? `Los ítems suman más que el total de la factura (${formatMoneda(total ?? 0)}): revisá cantidades y precios.`
            : hayCargos
              ? "La diferencia suele ser impuestos y otros cargos. Si no coincide con la factura, revisá los ítems."
              : ""}
        </p>
        <dl
          className="num"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "6px 24px",
            width: 300,
            maxWidth: "100%",
            margin: 0,
            fontSize: 13,
            lineHeight: "18px",
            color: "var(--color-text-primary)",
          }}
        >
          {(hayCargos || noCoincide) && (
            <>
              <dt style={{ color: "var(--color-text-secondary)" }}>Suma de ítems</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>{formatMoneda(subtotal)}</dd>
            </>
          )}
          {hayCargos && (
            <>
              <dt style={{ color: "var(--color-text-secondary)" }}>Diferencia con el total</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>{formatMoneda(diferencia)}</dd>
            </>
          )}
          <dt style={{ fontWeight: 500, paddingTop: 8, borderTop: "1px solid var(--color-border)", alignSelf: "end" }}>Total</dt>
          <dd
            id="invoice-total"
            style={{ margin: 0, textAlign: "right", fontSize: 18, lineHeight: "24px", fontWeight: 500, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}
          >
            {formatMoneda(total ?? subtotal)}
          </dd>
        </dl>
      </div>
    </section>
  );
}
