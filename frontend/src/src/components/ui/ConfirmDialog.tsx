"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Button from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Qué va a pasar, en una o dos oraciones. */
  description?: ReactNode;
  /** Contenido extra, p. ej. la comparación "precio actual → sugerido". */
  children?: ReactNode;
  /** El texto dice exactamente qué pasa: "aplicar $970", "salir sin guardar". */
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" cuando confirmar descarta o pierde algo. */
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Diálogo de confirmación (plan 0.10). Solo para acciones irreversibles o con plata:
 * aplicar un precio, salir de una revisión, salir sin guardar.
 * Usa <dialog> nativo: atrapa el foco, cierra con Esc y bloquea el fondo.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "cancelar",
  tone = "primary",
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="confirm-dialog-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc: el estado lo maneja quien abre el diálogo
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel(); // clic en el fondo
      }}
    >
      <h2 id="confirm-dialog-title">{title}</h2>
      {description && <p className="dialog-text">{description}</p>}
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
