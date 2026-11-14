// IaBanner — línea única compacta con badge de confianza
// Wireframe: una sola línea de texto + badge a la derecha, fondo tintado

import Badge, { type BadgeTone } from "../ui/Badge";

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

const CONF: Record<Props["confidence"], { tone: BadgeTone; label: string }> = {
  alta:  { tone: "success", label: "confianza alta" },
  media: { tone: "neutral", label: "confianza media" },
  baja:  { tone: "warning", label: "confianza baja" },
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
        <strong>{productCount} productos</strong> por un total de{" "}
        <strong>{total}</strong>.{" "}
        <span style={{ color: "var(--color-text-secondary)", fontWeight: 400 }}>Revisá antes de confirmar.</span>
      </p>
      <Badge tone={conf.tone}>{conf.label}</Badge>
    </div>
  );
}
