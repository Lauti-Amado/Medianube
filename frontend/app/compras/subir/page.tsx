"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import AppLayout from "../../../src/src/components/layout/AppLayout";
import FileDropzone from "../../../src/src/components/invoices/FileDropzone";
import IaBanner from "../../../src/src/components/invoices/IaBanner";
import InvoiceTable, { InvoiceItem } from "../../../src/src/components/invoices/InvoiceTable";
import { uploadInvoice } from "../../../lib/upload";
import { validarArchivo } from "../../../lib/validarArchivo";

const iconStyle: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "14px",
  lineHeight: 1,
  userSelect: "none",
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SubirFacturaPage() {
  const router = useRouter();
  // Se inicializa vacío. El deshardcodeo significa que no hay datos falsos.
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [proveedorDetectado, setProveedorDetectado] = useState<any>(null);


  async function handleConfirm() {
    if (!file) return;
    const validationError = await validarArchivo(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    setUploadError(null);
    setProgress(0);
    setIsProcessing(true);
    
    try {
      await uploadInvoice(file, { onProgress: setProgress });
      
      // TODO: Aquí iría el polling al backend (GET /gastos?archivoS3=key)
      // para esperar que la cola SQS y Gemini terminen de procesar.
      // Por ahora, redirigimos a la vista general tras la subida exitosa.
      router.push(`/compras?subida=ok&archivo=${encodeURIComponent(file.name)}`);
      
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Falló la subida.");
      setProgress(null);
      setIsProcessing(false);
    }
  }

  const total = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  const totalFormatted = "$" + total.toLocaleString("es-AR");

  function handleItemChange(id: string, field: "product" | "quantity" | "unitPrice", value: string | number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  return (
    <AppLayout activeTab="compras">
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>

        {/* ── Back link ─────────────────────────────────────────────── */}
        <Link
          href="/compras"
          id="back-to-compras"
          style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            fontSize: "12px", color: "var(--color-text-secondary)", textDecoration: "none",
            marginBottom: "14px", transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; }}
        >
          <span style={iconStyle}>arrow_back</span>
          volver a compras
        </Link>

        {/* ── Page title ────────────────────────────────────────────── */}
        <h1 style={{ fontSize: "20px", fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 16px", letterSpacing: "-0.01em" }}>
          Subir factura
        </h1>

        {!file && <FileDropzone onFileSelected={setFile} />}

        {/* ── Two-column: File card + Supplier detected ─────────────── */}
        {file && (<>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", marginBottom: "12px" }}>

          {/* File card */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "12px 14px",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <span style={{ ...iconStyle, fontSize: "22px", color: "var(--color-accent)", flexShrink: 0 }}>description</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </p>
              <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>{formatSize(file.size)}</p>
            </div>
            <button
                type="button"
                onClick={() => setFile(null)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "var(--color-text-muted)", padding: "4px", flexShrink: 0, transition: "color 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-warning-text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
              >
                <span style={{ ...iconStyle, fontSize: "13px" }}>close</span>
                Quitar
              </button>
          </div>

          {/* Supplier detected card (Solo se muestra si hay datos reales) */}
          {proveedorDetectado && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                minWidth: "200px",
              }}
            >
              <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 4px" }}>
                Distribuidora detectada
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
                  {proveedorDetectado.nombre}
                </p>
                <span style={{ backgroundColor: "var(--color-success-bg)", color: "var(--color-success-text)", fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}>
                  {proveedorDetectado.coincidencia}% coincidencia
                </span>
              </div>
              <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>
                CUIT {proveedorDetectado.cuit}
              </p>
            </div>
          )}
        </div>

        {/* ── IA Banner (Solo si hay items) ────────────────────────────────────────────────── */}
        {items.length > 0 && (
           <IaBanner productCount={items.length} total={totalFormatted} confidence="alta" />
        )}

        {/* ── Editable invoice table (Solo si hay items) ───────────────────────────────────── */}
        {items.length > 0 && (
          <InvoiceTable
            items={items}
            editingId={editingId}
            onEdit={setEditingId}
            onItemChange={handleItemChange}
          />
        )}
        </>)}

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px" }}>
          {uploadError && (
            <p style={{ fontSize: "12px", color: "var(--color-warning-text)", margin: 0 }}>{uploadError}</p>
          )}
          <button
            id="invoice-cancel"
            type="button"
            onClick={() => router.push("/compras")}
            style={{
              padding: "9px 20px", fontSize: "13px", fontWeight: 500,
              backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)", color: "var(--color-text-primary)", cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-border-strong)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
          >
            Cancelar
          </button>
          <button
            id="invoice-confirm"
            type="button"
            disabled={!file || progress !== null || isProcessing}
            onClick={handleConfirm}
            style={{
              padding: "9px 20px", fontSize: "13px", fontWeight: 500,
              backgroundColor: "var(--color-accent)", border: "none",
              borderRadius: "var(--radius-md)", color: "#FFFFFF", cursor: "pointer",
              transition: "background-color 0.15s",
              display: "inline-flex", alignItems: "center", gap: "7px",
              opacity: (!file || progress !== null || isProcessing) ? 0.6 : 1
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-accent-dark)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-accent)"; }}
          >
            <span style={{ ...iconStyle, fontSize: "15px" }}>{isProcessing ? "hourglass_empty" : "check_circle"}</span>
            {progress !== null ? `Subiendo… ${progress}%` : isProcessing ? "Procesando en IA..." : "Confirmar y guardar"}
          </button>
        </div>

      </div>
    </AppLayout>
  );
}