import type { CSSProperties, ReactNode } from "react";
import Icon from "./Icon";

interface CardProps {
  id?: string;
  /** Título de la tarjeta (14px/500, sentence case). Si falta, no hay encabezado. */
  title?: ReactNode;
  /** Ícono de Material Symbols a la izquierda del título. */
  icon?: string;
  /** Contenido a la derecha del encabezado: un link "ver todas", un contador, etc. */
  action?: ReactNode;
  /** `false` deja el cuerpo sin padding, para tablas que llegan hasta el borde. */
  padded?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

export default function Card({ id, title, icon, action, padded = true, style, children }: CardProps) {
  return (
    <section id={id} className="card" style={style}>
      {title && (
        <header className="card-header">
          <h2 className="card-title">
            {icon && <Icon name={icon} size={16} />}
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className={padded ? "card-body" : undefined}>{children}</div>
    </section>
  );
}
