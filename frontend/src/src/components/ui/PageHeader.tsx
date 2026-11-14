import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Va junto al título, p. ej. la marca de IA. */
  badge?: ReactNode;
  /** Acción principal de la pantalla, a la derecha. */
  action?: ReactNode;
}

/** Encabezado único de pantalla (plan 0.11): título 20px/500, subtítulo 13px y acción a la derecha. */
export default function PageHeader({ title, subtitle, badge, action }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div style={{ minWidth: 0 }}>
        <h1>
          {title}
          {badge}
        </h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>{action}</div>}
    </header>
  );
}
