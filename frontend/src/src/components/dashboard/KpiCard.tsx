const iconStyle: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "14px",
  lineHeight: 1,
  userSelect: "none",
};

interface KpiTrend {
  direction: "up" | "down" | "stable";
  delta: string;
  positive?: boolean; // si "up" es positivo o negativo (ej: alertas, "up" es malo)
}

interface KpiCardProps {
  id: string;
  label: string;
  value: string;
  isAlert?: boolean;
  trend?: KpiTrend;
}

export default function KpiCard({ id, label, value, isAlert, trend }: KpiCardProps) {
  const trendColor =
    !trend
      ? undefined
      : trend.direction === "stable"
      ? "var(--color-text-muted)"
      : trend.positive
      ? "var(--color-success-text)"
      : "var(--color-warning-text)";

  const trendIcon =
    trend?.direction === "up"
      ? "arrow_upward"
      : trend?.direction === "down"
      ? "arrow_downward"
      : "remove";

  return (
    <div
      id={id}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        minHeight: "90px",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          color: "var(--color-text-secondary)",
          margin: 0,
          fontWeight: 400,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "22px",
          fontWeight: 600,
          color: isAlert ? "var(--color-warning-text)" : "var(--color-text-primary)",
          margin: 0,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          flex: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        {value}
      </p>
      {/* Trend area: always rendered at fixed height to keep cards aligned */}
      <div
        style={{
          height: "18px",
          display: "flex",
          alignItems: "center",
          gap: "3px",
          overflow: "hidden",
        }}
      >
        {trend && (
          <>
            <span style={{ ...iconStyle, color: trendColor, fontSize: "12px", flexShrink: 0 }}>
              {trendIcon}
            </span>
            <span
              style={{
                fontSize: "11px",
                color: trendColor,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {trend.delta}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
