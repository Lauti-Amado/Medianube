import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import Icon from "./Icon";

/**
 * Jerarquía de botones (plan 0.3):
 * - primary: acento sólido. Uno solo por pantalla.
 * - secondary: borde. Acciones alternativas ("cancelar", "exportar").
 * - accent: secundario con borde de acento, para acciones repetidas en filas ("aplicar").
 * - text: texto en acento, para navegación liviana ("ver todas").
 * - warning: borde de advertencia ("reintentar", "revisar").
 * - danger: sólido de advertencia. Solo para confirmar algo irreversible en un diálogo.
 */
export type ButtonVariant = "primary" | "secondary" | "accent" | "text" | "warning" | "danger";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  /** Nombre de un ícono de Material Symbols, a la izquierda del texto. */
  icon?: string;
  /** Ícono a la derecha del texto (p. ej. chevron_right en "ver todas"). */
  iconEnd?: string;
  block?: boolean;
  /** Si se pasa, el botón se renderiza como link de Next. */
  href?: string;
  children: ReactNode;
}

export default function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconEnd,
  block,
  href,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const className = [
    "btn",
    `btn-${variant}`,
    size === "sm" ? "btn-sm" : "",
    block ? "btn-block" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const iconSize = size === "sm" ? 14 : 16;

  const content = (
    <>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={iconSize} />}
    </>
  );

  if (href && !rest.disabled) {
    return (
      <Link href={href} id={rest.id} className={className} aria-label={rest["aria-label"]}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={className} {...rest}>
      {content}
    </button>
  );
}
