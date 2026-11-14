interface StepProgressProps {
  step: number;
  total: number;
}

/**
 * Barra de progreso segmentada de los flujos de acceso (recuperar contraseña, onboarding),
 * con el texto "paso N de M" a la derecha para que se sepa cuánto falta.
 */
export default function StepProgress({ step, total }: StepProgressProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-valuetext={`paso ${step} de ${total}`}
        style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${total}, 1fr)`, gap: "6px" }}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            style={{
              height: "4px",
              borderRadius: "9999px",
              backgroundColor: i < step ? "var(--color-accent)" : "var(--color-border-divider)",
              transition: "background-color 0.3s ease",
            }}
          />
        ))}
      </div>
      <span aria-hidden="true" style={{ fontSize: "12px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
        paso {step} de {total}
      </span>
    </div>
  );
}
