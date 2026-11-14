import type { ReactNode } from "react";
import Icon from "./Icon";

export type BadgeTone = "success" | "warning" | "neutral" | "ia";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

/**
 * Badge único del sistema (plan 0.4): pill, 11px/500 y siempre con texto.
 * El tono "ia" es la marca de IA (plan 0.6): lleva el sparkle y se usa solo
 * en contenido generado por IA. `<Badge tone="ia">IA</Badge>`
 */
export default function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span className={`badge badge-${tone}`}>
      {tone === "ia" && <Icon name="auto_awesome" size={12} />}
      {children}
    </span>
  );
}
