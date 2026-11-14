import Icon from "./Icon";

interface StepperProps {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** Nombre de lo que se cuenta, para lectores de pantalla: "sucursales". */
  label: string;
}

/**
 * Control `− 1 +` para números chicos (1–10). No deja escribir un valor inválido.
 */
export default function Stepper({ id, value, min = 1, max = 10, onChange, label }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`quitar una de ${label}`}>
        <Icon name="remove" size={16} />
      </button>
      <output id={id} aria-live="polite">
        {value}
      </output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`sumar una a ${label}`}>
        <Icon name="add" size={16} />
      </button>
    </div>
  );
}
