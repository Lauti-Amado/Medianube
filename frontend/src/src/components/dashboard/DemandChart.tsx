// Gráfico compacto de demanda: los próximos 7 días predichos (la API no devuelve ventas pasadas).
// En el dashboard alcanza con la tendencia; el detalle está en /demanda.

export interface DemandDay {
  /** Etiqueta del eje, con la fecha: "sá 14". */
  label: string;
  value: number;
  predicted: boolean;
  isToday?: boolean;
}

const BAR_AREA = 130; // alto del área de barras, en px

export default function DemandChart({ days }: { days: DemandDay[] }) {
  const max = Math.max(...days.map((d) => d.value), 1);
  const predicted = days.filter((d) => d.predicted);
  const peak = predicted.length ? Math.max(...predicted.map((d) => d.value)) : null;

  const resumen = days.map((d) => `${d.label}: ${d.value}`).join(", ");

  return (
    <figure style={{ margin: 0 }} role="img" aria-label={`Unidades por día. ${resumen}`}>
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          height: BAR_AREA + 20,
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {[33, 66].map((pct) => (
          <div
            key={pct}
            style={{ position: "absolute", left: 0, right: 0, bottom: (pct * BAR_AREA) / 100, borderTop: "1px dashed var(--color-border-divider)" }}
          />
        ))}
        {days.map((d, i) => {
          const isPeak = d.predicted && d.value === peak;
          return (
            <div
              key={i}
              style={{ position: "relative", flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}
            >
              {/* Divisor "hoy": separa lo que pasó de lo que se espera */}
              {d.isToday && (
                <div style={{ position: "absolute", top: 0, bottom: 0, right: -1, borderRight: "1px dashed var(--color-border-strong)" }} />
              )}
              {isPeak && (
                <span style={{ fontSize: 11, lineHeight: "14px", fontWeight: 500, color: "var(--color-accent-dark)", marginBottom: 4 }}>{d.value}</span>
              )}
              <div
                style={{
                  width: "58%",
                  height: Math.max(Math.round((d.value / max) * BAR_AREA), 2),
                  borderRadius: "4px 4px 0 0",
                  backgroundColor: d.predicted ? "var(--color-bar-predicted)" : "var(--color-bar-historic)",
                }}
              />
            </div>
          );
        })}
      </div>

      <div aria-hidden="true" style={{ display: "flex", marginTop: 8 }}>
        {days.map((d, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 11,
              lineHeight: "14px",
              whiteSpace: "nowrap",
              color: d.isToday ? "var(--color-accent-dark)" : "var(--color-text-secondary)",
              fontWeight: d.isToday ? 500 : 400,
            }}
          >
            {d.label}
            {d.isToday && " · hoy"}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function DemandLegend() {
  const items = [{ color: "var(--color-bar-predicted)", label: "próximos 7 días" }];
  return (
    <div style={{ display: "flex", gap: 16, flexShrink: 0, fontSize: 12, lineHeight: "16px", color: "var(--color-text-secondary)" }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
