"use client";

// FileDropzone — zona para arrastrar o elegir la factura (PDF o imagen)

import { useRef, useState } from "react";

export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const iconStyle: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "28px",
  lineHeight: 1,
  userSelect: "none",
};

interface Props {
  onFileSelected: (file: File) => void;
}

function validate(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Formato no soportado. Subí un PDF, JPG o PNG.";
  if (file.size > MAX_FILE_BYTES) return "El archivo supera los 10 MB.";
  return null;
}

export default function FileDropzone({ onFileSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  function handleFile(file: File | undefined) {
    if (!file) return;
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    onFileSelected(file);
  }

  return (
    <div style={{ marginBottom: "12px" }}>
      <div
        id="invoice-dropzone"
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          padding: "36px 16px",
          backgroundColor: isDragging ? "var(--color-accent-tint)" : "var(--color-surface)",
          border: `1.5px dashed ${isDragging ? "var(--color-accent)" : "var(--color-border-strong)"}`,
          borderRadius: "var(--radius-lg)",
          cursor: "pointer",
          textAlign: "center",
          transition: "background-color 0.15s, border-color 0.15s",
        }}
      >
        <span style={{ ...iconStyle, color: "var(--color-accent)" }}>upload_file</span>
        <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
          Arrastrá la factura acá o hacé click para elegirla
        </p>
        <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: 0 }}>
          PDF, JPG o PNG · hasta 10 MB
        </p>
        <input
          ref={inputRef}
          id="invoice-file-input"
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          style={{ display: "none" }}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = ""; // permite volver a elegir el mismo archivo
          }}
        />
      </div>
      {error && (
        <p style={{ fontSize: "12px", color: "var(--color-warning-text)", margin: "6px 0 0" }}>{error}</p>
      )}
    </div>
  );
}
