interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export default function Icon({ name, size = 18, className = "" }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: `${size}px` }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
