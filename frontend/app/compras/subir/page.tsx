"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AppLayout from "../../../src/src/components/layout/AppLayout";
import FileDropzone from "../../../src/src/components/invoices/FileDropzone";
import IaBanner from "../../../src/src/components/invoices/IaBanner";
import InvoiceTable, { InvoiceItem } from "../../../src/src/components/invoices/InvoiceTable";
import { uploadInvoice } from "../../../lib/upload";
import { validarArchivo } from "../../../lib/validarArchivo";

const COMPRAS_URL = "https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com/compras";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

interface ItemOcrApi {
  descripcion?: string;
  cantidad?: number | string;
  precio_unitario?: number | string;
  precioUnitario?: number | string;
}

interface GastoOcrApi {
  gastoID?: string;
  proveedor?: string;
  cuitProveedor?: string | null;
  categoria?: string;
  monto?: number | string;
  archivoS3?: string;
  items?: ItemOcrApi[];
}

interface ProveedorDetectado {
  nombre: string;
  cuit: string;
}

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

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function esperarExtraccionOcr(s3Key: string, nombreArchivo: string): Promise<GastoOcrApi> {
  const inicio = Date.now();

  while (Date.now() - inicio < POLL_TIMEOUT_MS) {
    await esperar(POLL_INTERVAL_MS);

    const res = await fetch(COMPRAS_URL, { method: "GET" });
    if (!res.ok) continue;

    const data = await res.json();
    const gastos: GastoOcrApi[] = Array.isArray(data?.gastos)
      ? data.gastos
      : Array.isArray(data)
        ? data
        : [];

    const encontrado = gastos.find(
      (g) =>
        (s3Key && g.archivoS3 === s3Key) ||
        (g.archivoS3 && g.archivoS3.endsWith(nombreArchivo))
    );

    if (encontrado) return encontrado;
  }

  throw new Error("El análisis por IA demoró más de 60 segundos. Podés verificar la factura más tarde en el historial de compras.");
}

export default function SubirFacturaPage() {
  const router = useRouter();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrReady, setOcrReady] = useState(false);
  const [proveedorDetectado, setProveedorDetectado] = useState<ProveedorDetectado | null>(null);

  function resetearArchivo() {
    setFile(null);
    setItems([]);
    setProveedorDetectado(null);
    setOcrReady(false);
    setUploadError(null);
    setProgress(null);
    setIsProcessing(false);
  }

  async function handleUploadAndAnalyze() {
    if (!file) return;
    const validationError = await validarArchivo(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    setUploadError(null);
    setProgress(0);

    try {
      const resultadoSubida = await uploadInvoice(file, { onProgress: setProgress });
      const s3Key = resultadoSubida ? String(resultadoSubida) : "";

      setProgress(null);
      setIsProcessing(true);

      const gasto = await esperarExtraccionOcr(s3Key, file.name);

      setProveedorDetectado({
        nombre: gasto.proveedor || "Proveedor detectado",
        cuit: gasto.cuitProveedor ? `CUIT ${gasto.cuitProveedor}` : "CUIT no informado",
      });

      const itemsExtraidos: InvoiceItem[] = (gasto.items ?? []).map((it, idx) => ({
        id: `ocr-${idx}`,
        product: it.descripcion || `Ítem ${idx + 1}`,
        tags: gasto.categoria ? [gasto.categoria] : [],
        quantity: Number(it.cantidad) || 1,
        unitPrice: Number(it.precio_unitario ?? it.precioUnitario) || 0,
        confidence: "alta",
      }));

      setItems(itemsExtraidos);
      setOcrReady(true);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Falló el procesamiento de la factura.");
    } finally {
      setProgress(null);
      setIsProcessing(false);
    }
  }

  function handleConfirm() {
    if (!file) return;
    router.push(`/compras?subida=ok&archivo=${encodeURIComponent(file.name)}`);
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
        {file && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: proveedorDetectado ? "1fr auto" : "1fr", gap: "12px", marginBottom: "12px" }}>

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
                  disabled={progress !== null || isProcessing}
                  onClick={resetearArchivo}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "12px", color: "var(--color-text-muted)", padding: "4px", flexShrink: 0, transition: "color 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-warning-text)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
                >
                  <span style={{ ...iconStyle, fontSize: "13px" }}>close</span>
                  Quitar
                </button>
              </div>

              {/* Supplier detected card */}
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
                      IA OCR
                    </span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>
                    {proveedorDetectado.cuit}
                  </p>
                </div>
              )}
            </div>

            {isProcessing && (
              <div
                style={{
                  padding: "24px 16px",
                  marginBottom: "16px",
                  textAlign: "center",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg)",
                  fontSize: "13px",
                  color: "var(--color-text-secondary)",
                }}
              >
                Procesando factura en la cola SQS con Gemini Vision… (esto puede demorar unos segundos)
              </div>
            )}

            {/* ── IA Banner ────────────────────────────────────────────────── */}
            {ocrReady && items.length > 0 && (
              <IaBanner productCount={items.length} total={totalFormatted} confidence="alta" />
            )}

            {/* ── Editable invoice table ───────────────────────────────────── */}
            {ocrReady && items.length > 0 && (
              <InvoiceTable
                items={items}
                editingId={editingId}
                onEdit={setEditingId}
                onItemChange={handleItemChange}
              />
            )}
          </>
        )}

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

          {!ocrReady ? (
            <button
              id="invoice-upload"
              type="button"
              disabled={!file || progress !== null || isProcessing}
              onClick={handleUploadAndAnalyze}
              style={{
                padding: "9px 20px", fontSize: "13px", fontWeight: 500,
                backgroundColor: "var(--color-accent)", border: "none",
                borderRadius: "var(--radius-md)", color: "#FFFFFF", cursor: "pointer",
                transition: "background-color 0.15s",
                display: "inline-flex", alignItems: "center", gap: "7px",
                opacity: !file || progress !== null || isProcessing ? 0.6 : 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-accent-dark)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-accent)"; }}
            >
              <span style={{ ...iconStyle, fontSize: "15px" }}>
                {isProcessing ? "hourglass_empty" : "upload_file"}
              </span>
              {progress !== null
                ? `Subiendo… ${progress}%`
                : isProcessing
                  ? "Analizando con IA…"
                  : "Subir y extraer datos"}
            </button>
          ) : (
            <button
              id="invoice-confirm"
              type="button"
              onClick={handleConfirm}
              style={{
                padding: "9px 20px", fontSize: "13px", fontWeight: 500,
                backgroundColor: "var(--color-accent)", border: "none",
                borderRadius: "var(--radius-md)", color: "#FFFFFF", cursor: "pointer",
                transition: "background-color 0.15s",
                display: "inline-flex", alignItems: "center", gap: "7px",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-accent-dark)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-accent)"; }}
            >
              <span style={{ ...iconStyle, fontSize: "15px" }}>check_circle</span>
              Confirmar y guardar
            </button>
          )}
        </div>

      </div>
    </AppLayout>
  );
}