"use client";

import { useEffect, useRef } from "react";
import Button from "../../src/src/components/ui/Button";
import Icon from "../../src/src/components/ui/Icon";
import { formatMoneda } from "../../lib/formato";
import type { Invoice } from "../../lib/compras";

interface Props {
  /** Factura a mostrar; `null` cierra el modal. */
  factura: Invoice | null;
  /** El mismo formato de fecha que la tabla ("10/11/2026"). */
  formatearFecha: (fecha: string) => string;
  onClose: () => void;
}

const celda: React.CSSProperties = { padding: "8px 0", fontSize: 13, borderTop: "1px solid var(--color-border-subtle)" };
const encabezado: React.CSSProperties = { padding: "0 0 8px", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textAlign: "left" };
const derecha: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap", paddingLeft: 16 };

/**
 * Desglose de una factura: los ítems (`items`) que extrajo Gemini, con cantidad, precio unitario y subtotal.
 * Usa <dialog> nativo, como ConfirmDialog: atrapa el foco, cierra con Esc y con clic en el fondo.
 */
export default function DesgloseFactura({ factura, formatearFecha, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (factura && !dialog.open) dialog.showModal();
    if (!factura && dialog.open) dialog.close();
  }, [factura]);

  const items = factura?.itemList ?? [];
  const subtotal = (cantidad: number | null, precio: number | null) => (cantidad != null && precio != null ? cantidad * precio : null);

  return (
    <dialog
      ref={ref}
      className="dialog"
      style={{ width: "min(640px, calc(100vw - 32px))" }}
      aria-labelledby="desglose-titulo"
      onCancel={(e) => {
        e.preventDefault(); // Esc: el estado lo maneja la página
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // clic en el fondo
      }}
    >
      {factura && (
        <>
          <h2 id="desglose-titulo">{factura.provider}</h2>
          <p className="dialog-text">
            {formatearFecha(factura.date)} · {items.length === 1 ? "1 ítem" : `${items.length} ítems`} · total {formatMoneda(factura.total)}
          </p>

          {factura.alert && (
            <p style={{ fontSize: 13, color: "var(--color-warning-text)", margin: "12px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="warning" size={16} />
              {factura.alert}
            </p>
          )}

          <div style={{ marginTop: 16, maxHeight: "50vh", overflowY: "auto" }}>
            {items.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>
                Esta factura no tiene el detalle de ítems cargado.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th scope="col" style={encabezado}>Producto</th>
                    <th scope="col" style={{ ...encabezado, ...derecha }}>Cantidad</th>
                    <th scope="col" style={{ ...encabezado, ...derecha }}>Precio unit.</th>
                    <th scope="col" style={{ ...encabezado, ...derecha }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td style={{ ...celda, color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>{it.description}</td>
                      <td className="num" style={{ ...celda, ...derecha, color: "var(--color-text-secondary)" }}>{it.quantity ?? "—"}</td>
                      <td className="num" style={{ ...celda, ...derecha, color: "var(--color-text-secondary)" }}>{formatMoneda(it.unitPrice)}</td>
                      <td className="num" style={{ ...celda, ...derecha, fontWeight: 500 }}>{formatMoneda(subtotal(it.quantity, it.unitPrice))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="dialog-actions">
            <Button id="btn-cerrar-desglose" variant="secondary" onClick={onClose}>
              cerrar
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
