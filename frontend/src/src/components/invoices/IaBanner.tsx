// IaBanner — línea única compacta con badge de confianza
// Wireframe: una sola línea de texto + badge a la derecha, fondo tintado

const iconStyle: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "15px",
  lineHeight: 1,
  userSelect: "none",
  flexShrink: 0,
};

interface Props {
  productCount: number;
  total: string;
  confidence: "alta" | "media" | "baja";
}

const CONF = {
  alta:  { bg: "var(--color-success-bg)",  text: "var(--color-success-text)", icon: "verified", label: "Confianza alta" },
  media: { bg: "var(--color-neutral-bg)",  text: "var(--color-neutral-text)", icon: "info",     label: "Confianza media" },
  baja:  { bg: "var(--color-warning-bg)",  text: "var(--color-warning-text)", icon: "warning",  label: "Confianza baja" },
};

export default function IaBanner({ productCount, total, confidence }: Props) {
  const conf = CONF[confidence];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        backgroundColor: "var(--color-accent-tint)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "11px 14px",
        marginBottom: "16px",
      }}
    >
      <span style={{ ...iconStyle, color: "var(--color-accent)" }}>auto_awesome</span>
      <p style={{ flex: 1, fontSize: "13px", color: "var(--color-text-callout)", margin: 0 }}>
        La IA detectó{" "}
        <strong style={{ fontWeight: 600 }}>{productCount} productos</strong> por un total de{" "}
        <strong style={{ fontWeight: 600 }}>{total}</strong>.{" "}
        <span style={{ color: "var(--color-text-secondary)", fontWeight: 400 }}>Revisá antes de confirmar.</span>
      </p>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          backgroundColor: conf.bg,
          color: conf.text,
          fontSize: "11px",
          fontWeight: 500,
          padding: "3px 9px",
          borderRadius: "var(--radius-full)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <span style={{ ...iconStyle, fontSize: "12px" }}>{conf.icon}</span>
        {conf.label}
      </span>
    </div>
  );
}
