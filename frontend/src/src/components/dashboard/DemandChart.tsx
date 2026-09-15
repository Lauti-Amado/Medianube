// SVG demand chart — 7 historic bars + 7 predicted bars, no external dependencies

const CHART_HEIGHT = 180;
const BAR_WIDTH = 28;
const BAR_GAP = 10;
const TOTAL_BARS = 14;
const TODAY_INDEX = 6; // bar index where "today" divider sits (between 6 and 7)

// Raw demand data (units): indices 0-6 historic, 7-13 predicted
const DATA = [320, 285, 310, 295, 340, 305, 290, 315, 330, 360, 340, 420, 390, 410];
const PEAK_INDEX = DATA.indexOf(Math.max(...DATA)); // index of highest bar

const MAX_VAL = Math.max(...DATA);

export default function DemandChart() {
  const chartWidth = TOTAL_BARS * (BAR_WIDTH + BAR_GAP) - BAR_GAP + 2; // slight padding
  const todayX = (TODAY_INDEX + 1) * (BAR_WIDTH + BAR_GAP) - BAR_GAP / 2;

  const DAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

  return (
    <div style={{ width: "100%" }}>
      {/* Chart */}
      <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT + 28}`}
          style={{ width: "100%", display: "block" }}
          aria-label="Gráfico de barras de demanda histórica vs predicción IA"
        >
          {/* Bars */}
          {DATA.map((val, i) => {
            const barHeight = Math.round((val / MAX_VAL) * CHART_HEIGHT);
            const x = i * (BAR_WIDTH + BAR_GAP);
            const y = CHART_HEIGHT - barHeight;
            const isHistoric = i <= TODAY_INDEX;
            const isPeak = i === PEAK_INDEX;

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_WIDTH}
                  height={barHeight}
                  rx={3}
                  fill={isHistoric ? "var(--color-bar-historic)" : "var(--color-bar-predicted)"}
                />
                {/* Peak badge */}
                {isPeak && (
                  <>
                    <rect
                      x={x - 8}
                      y={y - 20}
                      width={36}
                      height={16}
                      rx={4}
                      fill="var(--color-warning-bg)"
                    />
                    <text
                      x={x + BAR_WIDTH / 2}
                      y={y - 8}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="500"
                      fill="var(--color-warning-text)"
                    >
                      +35%
                    </text>
                  </>
                )}
                {/* Day label */}
                <text
                  x={x + BAR_WIDTH / 2}
                  y={CHART_HEIGHT + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-text-muted)"
                >
                  {DAY_LABELS[i]}
                </text>
              </g>
            );
          })}

          {/* "Hoy" divider line */}
          <line
            x1={todayX}
            y1={0}
            x2={todayX}
            y2={CHART_HEIGHT}
            stroke="var(--color-border-strong)"
            strokeWidth={1}
            strokeDasharray="4,3"
          />
          {/* "Hoy" label */}
          <rect
            x={todayX - 14}
            y={2}
            width={28}
            height={14}
            rx={3}
            fill="var(--color-accent-tint)"
          />
          <text
            x={todayX}
            y={12}
            textAnchor="middle"
            fontSize="9"
            fontWeight="500"
            fill="var(--color-accent-dark)"
          >
            hoy
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginTop: "10px",
          justifyContent: "center",
        }}
      >
        {[
          { color: "var(--color-bar-historic)", label: "Histórico real" },
          { color: "var(--color-bar-predicted)", label: "IA Proyectado" },
        ].map(({ color, label }) => (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "2px",
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
