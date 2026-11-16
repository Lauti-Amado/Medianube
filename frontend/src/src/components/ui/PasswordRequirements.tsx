import Icon from "./Icon";

/** Requisitos de contraseña del User Pool de Cognito. */
const REQUISITOS: { label: string; test: (p: string) => boolean }[] = [
  { label: "8 caracteres o más", test: (p) => p.length >= 8 },
  { label: "una mayúscula", test: (p) => /[A-ZÁÉÍÓÚÑ]/.test(p) },
  { label: "una minúscula", test: (p) => /[a-záéíóúñ]/.test(p) },
  { label: "un número", test: (p) => /\d/.test(p) },
  { label: "un símbolo (!@#$)", test: (p) => /[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s]/.test(p) },
];

/** `true` si la contraseña cumple todos los requisitos. Sirve para validar antes de enviar. */
export function cumpleRequisitos(password: string) {
  return REQUISITOS.every((r) => r.test(password));
}

/** Lista de requisitos que se tildan mientras se escribe la contraseña. */
export default function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="pw-reqs" aria-label="requisitos de la contraseña">
      {REQUISITOS.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.label} className={ok ? "is-ok" : undefined}>
            <Icon name={ok ? "check_circle" : "radio_button_unchecked"} size={15} />
            {r.label}
            <span className="sr-only">{ok ? " (cumplido)" : " (falta)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
