"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AppLayout from "../../../src/src/components/layout/AppLayout";
import FileDropzone from "../../../src/src/components/invoices/FileDropzone";
import IaBanner from "../../../src/src/components/invoices/IaBanner";
import InvoiceTable, { InvoiceItem } from "../../../src/src/components/invoices/InvoiceTable";
import StepIndicator from "../../../src/src/components/invoices/StepIndicator";
import { uploadInvoice } from "../../../lib/upload";
import { validarArchivo } from "../../../lib/validarArchivo";
import { formatMoneda } from "../../../lib/formato";
import PageHeader from "../../../src/src/components/ui/PageHeader";
import Alert from "../../../src/src/components/ui/Alert";
import Badge from "../../../src/src/components/ui/Badge";
import Button from "../../../src/src/components/ui/Button";
import Icon from "../../../src/src/components/ui/Icon";
import Skeleton, { SkeletonRows } from "../../../src/src/components/ui/Skeleton";

const COMPRAS_URL = "https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com/compras";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

// El tercer paso es "revisar" y no "confirmar": la factura queda registrada apenas la IA la lee
const PASOS = ["subir", "lectura", "revisar"];

const QUE_VA_A_PASAR = [
  { icon: "document_scanner", titulo: "Leemos la factura por vos", texto: "Proveedor, ítems, cantidades y total." },
  { icon: "fact_check", titulo: "Revisás lo que leyó la IA", texto: "Comparás los datos con la factura antes de darla por buena." },
  { icon: "receipt_long", titulo: "Queda en tu historial", texto: "La factura se registra en Compras apenas termina la lectura." },
];

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

/** La IA no terminó a tiempo: la factura sigue su curso y va a aparecer en Compras. */
class LecturaDemorada extends Error {}
/** Se salió de la pantalla mientras se esperaba la lectura. */
class LecturaCancelada extends Error {}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function esperarExtraccionOcr(s3Key: string, nombreArchivo: string, sigue: () => boolean): Promise<GastoOcrApi> {
  const inicio = Date.now();

  while (Date.now() - inicio < POLL_TIMEOUT_MS) {
    await esperar(POLL_INTERVAL_MS);
    if (!sigue()) throw new LecturaCancelada();

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

  throw new LecturaDemorada();
}

export default function SubirFacturaPage() {
  const router = useRouter();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [totalFactura, setTotalFactura] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<{ mensaje: string; demorada?: boolean } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrReady, setOcrReady] = useState(false);
  const [proveedorDetectado, setProveedorDetectado] = useState<ProveedorDetectado | null>(null);

  // Corta la consulta periódica si se sale de la pantalla
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const subiendo = progress !== null;
  const ocupado = subiendo || isProcessing;

  function resetearArchivo() {
    setFile(null);
    setItems([]);
    setTotalFactura(null);
    setProveedorDetectado(null);
    setOcrReady(false);
    setError(null);
    setProgress(null);
    setIsProcessing(false);
  }

  async function handleUploadAndAnalyze() {
    if (!file) return;
    const validationError = await validarArchivo(file);
    if (validationError) {
      setError({ mensaje: validationError });
      return;
    }
    setError(null);
    setProgress(0);

    try {
      const resultadoSubida = await uploadInvoice(file, { onProgress: setProgress });
      const s3Key = resultadoSubida ? String(resultadoSubida) : "";

      setProgress(null);
      setIsProcessing(true);

      const gasto = await esperarExtraccionOcr(s3Key, file.name, () => montado.current);

      setProveedorDetectado({
        nombre: gasto.proveedor || "Proveedor sin identificar",
        cuit: gasto.cuitProveedor ? `CUIT ${gasto.cuitProveedor}` : "CUIT no informado",
      });

      // Sin `confidence`: el backend todavía no informa qué tan segura está la IA de cada ítem
      const itemsExtraidos: InvoiceItem[] = (gasto.items ?? []).map((it, idx) => ({
        id: `ocr-${idx}`,
        product: it.descripcion || `Ítem ${idx + 1}`,
        tags: [], // la categoría es de toda la factura: repetirla en cada fila no aporta
        quantity: Number(it.cantidad) || 1,
        unitPrice: Number(it.precio_unitario ?? it.precioUnitario) || 0,
      }));

      setItems(itemsExtraidos);
      setTotalFactura(Number(gasto.monto) || null);
      setOcrReady(true);
    } catch (err) {
      if (err instanceof LecturaCancelada) return;
      if (err instanceof LecturaDemorada) {
        setError({ mensaje: "La lectura está tardando más de lo normal. La factura va a aparecer en Compras cuando esté lista.", demorada: true });
      } else {
        setError({ mensaje: err instanceof Error ? err.message : "No pudimos procesar la factura. Probá de nuevo." });
      }
    } finally {
      setProgress(null);
      setIsProcessing(false);
    }
  }

  function volverACompras() {
    if (!file) return;
    router.push(`/compras?subida=ok&archivo=${encodeURIComponent(file.name)}`);
  }

  const sumaItems = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  const pasoActual = ocrReady ? 3 : isProcessing ? 2 : 1;

  return (
    <AppLayout activeTab="compras">
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        <Link href="/compras" id="back-to-compras" className="back-link">
          <Icon name="arrow_back" size={14} />
          volver a compras
        </Link>

        <PageHeader title="Subir factura" />

        <StepIndicator steps={PASOS} current={pasoActual} label="pasos para subir una factura" />

        {/* ── Paso 1, sin archivo: zona de arrastre + qué va a pasar ───────────── */}
        {!file && (
          <>
            <FileDropzone onFileSelected={setFile} />
            <ul
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                margin: "16px 0 0",
                padding: 0,
                listStyle: "none",
              }}
            >
              {QUE_VA_A_PASAR.map(({ icon, titulo, texto }) => (
                <li key={titulo} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ display: "flex", color: "var(--color-accent-dark)" }}>
                    <Icon name={icon} size={20} />
                  </span>
                  <div>
                    <p style={{ fontSize: 13, lineHeight: "18px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>{titulo}</p>
                    <p className="field-help" style={{ marginTop: 2 }}>{texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {file && (
          <>
            {/* ── Archivo y proveedor detectado, en una sola tarjeta ───────────── */}
            <div
              id="invoice-file-card"
              className="card"
              style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px", padding: "12px 16px", marginBottom: 12 }}
            >
              <span style={{ display: "flex", color: "var(--color-accent)" }}>
                <Icon name="description" size={24} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, lineHeight: "18px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0, overflowWrap: "anywhere" }}>
                  {file.name}
                </p>
                <p style={{ fontSize: 12, lineHeight: "17px", color: "var(--color-text-secondary)", margin: 0 }}>
                  {formatSize(file.size)}
                  {(isProcessing || ocrReady) && ", subida"}
                </p>
              </div>

              {(isProcessing || proveedorDetectado) && (
                <span aria-hidden="true" style={{ width: 1, alignSelf: "stretch", backgroundColor: "var(--color-border)" }} />
              )}
              {isProcessing && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 220 }}>
                  <Skeleton width="70%" />
                  <Skeleton width="45%" height={8} />
                </div>
              )}
              {proveedorDetectado && (
                <>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, lineHeight: "18px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
                      {proveedorDetectado.nombre}
                    </p>
                    <p style={{ fontSize: 12, lineHeight: "17px", color: "var(--color-text-secondary)", margin: 0 }}>
                      {proveedorDetectado.cuit}
                    </p>
                  </div>
                  <Badge tone="ia">IA</Badge>
                </>
              )}

              <span style={{ flex: 1 }} />
              {/* "quitar" solo antes de subir: después la factura ya quedó registrada */}
              {!ocupado && !ocrReady && (
                <Button id="invoice-remove-file" variant="text" size="sm" icon="close" onClick={resetearArchivo}>
                  quitar
                </Button>
              )}
            </div>

            {/* ── Subiendo / leyendo ───────────────────────────────────────────── */}
            {ocupado && (
              <>
                <Alert id="invoice-progress" tone="ia" icon={subiendo ? "upload" : undefined}>
                  {subiendo ? (
                    <strong>Subiendo la factura… {progress}%</strong>
                  ) : (
                    <>
                      <strong>Leyendo tu factura…</strong> Suele tardar unos segundos. Si preferís no esperar, la vas a ver en Compras cuando esté lista.
                    </>
                  )}
                  <div
                    className={`progress${subiendo ? "" : " is-indeterminate"}`}
                    role="progressbar"
                    aria-label={subiendo ? "subida de la factura" : "lectura de la factura"}
                    aria-valuenow={subiendo ? progress ?? 0 : undefined}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={subiendo ? { width: `${progress}%` } : undefined} />
                  </div>
                </Alert>
                <section className="card" style={{ margin: "12px 0 16px" }}>
                  <header className="card-header">
                    <h2 className="card-title">Ítems de la factura</h2>
                  </header>
                  <SkeletonRows rows={4} label="Leyendo los ítems de la factura" />
                </section>
              </>
            )}

            {/* ── Error ────────────────────────────────────────────────────────── */}
            {error && (
              <div style={{ marginBottom: 16 }}>
                <Alert
                  id="invoice-error"
                  tone="warning"
                  action={
                    error.demorada ? (
                      <Button variant="warning" size="sm" href="/compras">ir a compras</Button>
                    ) : (
                      <Button variant="warning" size="sm" onClick={handleUploadAndAnalyze}>reintentar</Button>
                    )
                  }
                >
                  {error.mensaje}
                </Alert>
              </div>
            )}

            {/* ── Paso 3: lo que leyó la IA ────────────────────────────────────── */}
            {ocrReady && items.length > 0 && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <IaBanner
                    productCount={items.length}
                    total={formatMoneda(totalFactura ?? sumaItems)}
                    lowConfidence={items.filter((i) => i.confidence === "baja").length}
                  />
                </div>
                <InvoiceTable items={items} total={totalFactura} />
              </>
            )}
            {ocrReady && items.length === 0 && (
              <div style={{ marginBottom: 16 }}>
                <Alert id="invoice-sin-items" tone="warning">
                  La factura quedó registrada
                  {totalFactura != null && <> por <strong>{formatMoneda(totalFactura)}</strong></>}, pero la IA no pudo separar los ítems.
                  Si la imagen estaba borrosa o cortada, probá subir una más nítida.
                </Alert>
              </div>
            )}
          </>
        )}

        {/* ── Acciones ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10, marginTop: file ? 0 : 24 }}>
          {ocrReady ? (
            <>
              <Button id="invoice-another" onClick={resetearArchivo}>
                subir otra factura
              </Button>
              <Button id="invoice-done" variant="primary" icon="check_circle" onClick={volverACompras}>
                listo, volver a compras
              </Button>
            </>
          ) : (
            <>
              <Button id="invoice-cancel" href="/compras">
                {isProcessing ? "volver a compras" : "cancelar"}
              </Button>
              <Button
                id="invoice-upload"
                variant="primary"
                icon={ocupado ? "hourglass_empty" : "upload_file"}
                disabled={!file || ocupado}
                onClick={handleUploadAndAnalyze}
              >
                {subiendo ? "subiendo…" : isProcessing ? "leyendo…" : "subir y extraer datos"}
              </Button>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
