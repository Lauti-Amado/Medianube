// FileCard — muestra el archivo ya cargado con opción de quitar

const iconStyle: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "22px",
  lineHeight: 1,
  userSelect: "none",
};

interface Props {
  fileName: string;
  fileSize: string;
  onRemove: () => void;
}

export default function FileCard({ fileName, fileSize, onRemove }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 14px",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        marginBottom: "12px",
      }}
    >
      {/* File icon */}
      <span style={{ ...iconStyle, color: "var(--color-accent)", flexShrink: 0 }}>
        description
      </span>

      {/* File info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--color-text-primary)",
            margin: "0 0 2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {fileName}
        </p>
        <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>
          {fileSize}
        </p>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "12px",
          color: "var(--color-text-muted)",
          padding: "4px 0",
          flexShrink: 0,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--color-warning-text)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--color-text-muted)";
        }}
      >
        quitar
      </button>
    </div>
  );
}
