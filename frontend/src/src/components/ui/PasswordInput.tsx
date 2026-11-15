import type { InputHTMLAttributes } from "react";
import Icon from "./Icon";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  /** Si la contraseña se muestra como texto. */
  visible: boolean;
  onToggleVisible: () => void;
  invalid?: boolean;
}

/** Campo de contraseña con el botón para mostrarla. Todos los campos de contraseña usan este. */
export default function PasswordInput({ visible, onToggleVisible, invalid, style, ...rest }: PasswordInputProps) {
  return (
    <div style={{ position: "relative" }}>
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className="input"
        aria-invalid={invalid || undefined}
        style={{ paddingRight: "40px", ...style }}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? "ocultar contraseña" : "mostrar contraseña"}
        style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--color-text-secondary)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Icon name={visible ? "visibility_off" : "visibility"} size={16} />
      </button>
    </div>
  );
}
