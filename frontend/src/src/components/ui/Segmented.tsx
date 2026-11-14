interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Cantidad que se muestra junto al label. */
  count?: number;
}

interface SegmentedProps<T extends string> {
  /** Qué se está eligiendo, para lectores de pantalla: "estado de la factura". */
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/** Selector segmentado: pocas opciones excluyentes a la vista, en lugar de un `select`. */
export default function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
          {opt.count != null && <span className="seg-count">{opt.count}</span>}
        </button>
      ))}
    </div>
  );
}
