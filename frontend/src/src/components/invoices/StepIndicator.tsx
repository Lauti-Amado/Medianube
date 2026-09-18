// StepIndicator — breadcrumb de pasos 1 → 2 → 3 para el flujo de subir factura

interface Props {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { num: 1, label: "subir" },
  { num: 2, label: "revisar" },
  { num: 3, label: "confirmar" },
];

export default function StepIndicator({ currentStep }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        marginBottom: "20px",
      }}
    >
      {STEPS.map(({ num, label }, i) => {
        const isActive = num === currentStep;
        const isPast = num < currentStep;
        const isFuture = num > currentStep;

        return (
          <div key={num} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Step pill */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "18px",
                  height: "18px",
                  borderRadius: "9999px",
                  fontSize: "10px",
                  fontWeight: 600,
                  flexShrink: 0,
                  backgroundColor: isActive
                    ? "var(--color-accent)"
                    : isPast
                    ? "var(--color-success-bg)"
                    : "var(--color-neutral-bg)",
                  color: isActive
                    ? "#FFFFFF"
                    : isPast
                    ? "var(--color-success-text)"
                    : "var(--color-text-muted)",
                }}
              >
                {isPast ? "✓" : num}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? "var(--color-accent)"
                    : isPast
                    ? "var(--color-text-secondary)"
                    : "var(--color-text-muted)",
                }}
              >
                {label}
              </span>
            </div>

            {/* Separator arrow */}
            {i < STEPS.length - 1 && (
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--color-border-strong)",
                  userSelect: "none",
                }}
              >
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
