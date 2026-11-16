"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";

interface ToastOptions {
  /** Texto de la confirmación. Usa el mismo verbo que el botón: "guardar" → "Cambios guardados". */
  message: ReactNode;
  tone?: "success" | "error";
  /** Acción opcional, casi siempre "deshacer". */
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

const DURATION = 5000;
const DURATION_WITH_ACTION = 8000; // más tiempo para llegar a "deshacer"

/** Confirmaciones breves de acciones (plan 0.10). Se monta una vez en `Providers`. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = ++nextId.current;
      setToasts((list) => [...list.slice(-2), { ...options, id }]);
      setTimeout(() => dismiss(id), options.action ? DURATION_WITH_ACTION : DURATION);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.tone === "error" ? " is-error" : ""}`}>
            <Icon name={t.tone === "error" ? "error" : "check_circle"} size={18} />
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** `const toast = useToast(); toast({ message: "Cambios guardados" })` */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
