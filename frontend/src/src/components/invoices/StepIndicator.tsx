// StepIndicator — pasos numerados de un flujo: hecho · actual · pendiente

import Icon from "../ui/Icon";

interface Props {
  /** Nombres de los pasos, en orden. */
  steps: string[];
  /** Paso actual, empezando en 1. */
  current: number;
  /** Nombre del flujo para lectores de pantalla. */
  label: string;
}

export default function StepIndicator({ steps, current, label }: Props) {
  return (
    <ol className="steps" aria-label={label}>
      {steps.map((step, i) => {
        const num = i + 1;
        const done = num < current;
        return (
          <li key={step} className={done ? "is-done" : undefined} aria-current={num === current ? "step" : undefined}>
            <span className="step-num">{done ? <Icon name="check" size={14} /> : num}</span>
            {step}
            {done && <span className="sr-only">(listo)</span>}
          </li>
        );
      })}
    </ol>
  );
}
