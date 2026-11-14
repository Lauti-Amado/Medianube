import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";
import Skeleton from "./Skeleton";

interface KpiTrend {
  direction: "up" | "down" | "stable";
  delta: string;
  /** Si el cambio es una buena noticia (en "alertas", subir es malo). */
  positive?: boolean;
}

interface KpiCardProps {
  id?: string;
  label: string;
  /** Valor principal. Un `<small>` adentro queda como unidad o contexto: `3 <small>de 32</small>`. */
  value: ReactNode;
  /** Pinta el valor en color de advertencia cuando el KPI representa un riesgo. */
  isAlert?: boolean;
  /** Ícono decorativo a la derecha del label. */
  icon?: string;
  /** Marca de IA junto al label: el dato lo calculó la IA. */
  ia?: boolean;
  trend?: KpiTrend;
  /** Pie libre (badge + texto). Tiene prioridad sobre `trend`. */
  footer?: ReactNode;
  /** Muestra skeletons en lugar del valor y el pie. */
  loading?: boolean;
  /** Si se pasa, toda la tarjeta es un link (atajo a la tarea). */
  href?: string;
}

const TREND_ICON = { up: "arrow_upward", down: "arrow_downward", stable: "remove" } as const;

export default function KpiCard({ id, label, value, isAlert, icon, ia, trend, footer, loading, href }: KpiCardProps) {
  const trendColor = !trend || trend.direction === "stable"
    ? undefined
    : trend.positive
      ? "var(--color-success-text)"
      : "var(--color-warning-text)";

  const body = (
    <>
      <p className="kpi-label">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {ia && (
            <span style={{ display: "inline-flex", color: "var(--color-accent)" }} title="calculado por IA">
              <Icon name="auto_awesome" size={14} />
            </span>
          )}
          {label}
        </span>
        {icon && <Icon name={icon} size={16} />}
      </p>
      <p className={`kpi-value${isAlert && !loading ? " is-warning" : ""}`}>
        {loading ? <Skeleton width={96} height={18} /> : value}
      </p>
      <div className="kpi-foot" style={{ color: loading ? undefined : trendColor }}>
        {loading ? (
          <Skeleton width={140} />
        ) : (
          footer ??
          (trend && (
            <>
              <Icon name={TREND_ICON[trend.direction]} size={12} />
              <span>{trend.delta}</span>
            </>
          ))
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link id={id} href={href} className={`kpi${isAlert ? " is-attention" : ""}`}>
        {body}
      </Link>
    );
  }
  return (
    <div id={id} className="kpi" aria-busy={loading || undefined}>
      {body}
    </div>
  );
}
