interface SkeletonProps {
  width?: number | string;
  height?: number;
}

/** Bloque de carga (plan 0.10). Reemplaza a "..." y "Cargando…". */
export default function Skeleton({ width = "100%", height = 10 }: SkeletonProps) {
  return <span className="skeleton" style={{ width, height }} aria-hidden="true" />;
}

const ROW_WIDTHS = ["38%", "30%", "44%", "34%", "40%"];

/** Filas de tabla en carga: anticipan la forma de lo que va a aparecer. */
export function SkeletonRows({ rows = 3, label = "Cargando" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px",
            borderTop: i > 0 ? "1px solid var(--color-border-subtle)" : "none",
          }}
        >
          <Skeleton width={ROW_WIDTHS[i % ROW_WIDTHS.length]} />
          <span style={{ flex: 1 }} />
          <Skeleton width="14%" />
          <Skeleton width="10%" />
        </div>
      ))}
    </div>
  );
}
