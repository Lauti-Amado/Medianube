// StepIndicator — breadcrumb de pasos 1 → 2 → 3 para el flujo de subir factura

import Icon from "../ui/Icon";

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
                  fontSize: "11px",
                  fontWeight: 500,
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
                    : "var(--color-text-secondary)",
                }}
              >
                {isPast ? <Icon name="check" size={12} /> : num}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "var(--color-accent-dark)" : "var(--color-text-secondary)",
                }}
              >
                {label}
              </span>
            </div>

            {/* Separator arrow */}
            {i < STEPS.length - 1 && (
              <span style={{ color: "var(--color-border-strong)", display: "flex" }}>
                <Icon name="chevron_right" size={14} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
