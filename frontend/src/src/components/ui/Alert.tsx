import type { ReactNode } from "react";
import Icon from "./Icon";

export type AlertTone = "warning" | "success" | "ia";

interface AlertProps {
  id?: string;
  tone: AlertTone;
  /** Ícono de Material Symbols. Por defecto, el del tono. */
  icon?: string;
  /** Botón o link a la derecha. */
  action?: ReactNode;
  children: ReactNode;
}

const DEFAULT_ICON: Record<AlertTone, string> = {
  warning: "warning",
  success: "check_circle",
  ia: "auto_awesome",
};

/**
 * Aviso en línea (plan 0.5): borde de 1px del color de estado más un ícono,
 * sin barra lateral gruesa. El tono "ia" es el banner de IA del DESIGN.md.
 */
export default function Alert({ id, tone, icon, action, children }: AlertProps) {
  return (
    <div id={id} className={`alert alert-${tone}`} role={tone === "warning" ? "alert" : "status"}>
      <Icon name={icon ?? DEFAULT_ICON[tone]} size={18} />
      <div className="alert-body">{children}</div>
      {action}
    </div>
  );
}
