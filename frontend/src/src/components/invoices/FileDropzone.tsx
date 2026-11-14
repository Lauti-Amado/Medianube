"use client";

// FileDropzone — zona para arrastrar o elegir la factura (PDF o imagen)

import { useRef, useState } from "react";
import { ACCEPT_ATTR, validarArchivo } from "../../../../lib/validarArchivo";
import Button from "../ui/Button";
import Icon from "../ui/Icon";

interface Props {
  onFileSelected: (file: File) => void;
}

export default function FileDropzone({ onFileSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const validationError = await validarArchivo(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    onFileSelected(file);
  }

  return (
    <div>
      {/* Toda la zona abre el selector con el mouse; con teclado se usa el botón "elegir archivo" */}
      <div
        id="invoice-dropzone"
        onClick={() => inputRef.current?.click()}
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
          padding: "52px 24px",
          backgroundColor: isDragging ? "var(--color-accent-tint)" : "var(--color-surface)",
          border: `1.5px dashed ${isDragging ? "var(--color-accent)" : "var(--color-border-strong)"}`,
          borderRadius: "var(--radius-xl)",
          cursor: "pointer",
          textAlign: "center",
          transition: "background-color 0.15s, border-color 0.15s",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            marginBottom: 14,
            border: "1px solid var(--color-border-strong)",
            borderRadius: "50%",
            backgroundColor: "var(--color-accent-tint)",
            color: "var(--color-accent)",
          }}
        >
          <Icon name="upload_file" size={24} />
        </span>
        <p style={{ fontSize: 14, lineHeight: "20px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
          Arrastrá la factura acá o elegila desde tu computadora
        </p>
        <p style={{ fontSize: 12, lineHeight: "17px", color: "var(--color-text-secondary)", margin: "4px 0 16px" }}>
          PDF, PNG, JPG o WEBP, hasta 10 MB
        </p>
        {/* Sin onClick propio: el clic sube hasta la zona, que abre el selector */}
        <Button id="invoice-choose-file" aria-describedby={error ? "invoice-file-error" : undefined}>
          elegir archivo
        </Button>
        <input
          ref={inputRef}
          id="invoice-file-input"
          type="file"
          accept={ACCEPT_ATTR}
          tabIndex={-1}
          aria-hidden="true"
          style={{ display: "none" }}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = ""; // permite volver a elegir el mismo archivo
          }}
        />
      </div>
      {error && (
        <p id="invoice-file-error" role="alert" className="field-error">
          <Icon name="error" size={14} />
          {error}
        </p>
      )}
    </div>
  );
}
