"use client";

import { useEffect, useRef, useState } from "react";
import Button from "../../src/src/components/ui/Button";
import { CATALOGO_VENTAS, guardarVenta, isoLocal, recalcularDemanda } from "../../lib/demanda";

interface ProductoOpcion {
  productoID: string;
  nombre: string;
}

interface Props {
  open: boolean;
  productos: ProductoOpcion[];
  onClose: () => void;
  onGuardada: (detalle: { nombre: string; cantidad: number; fecha: string; prediccionOk: boolean }) => void;
}

const campo: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };

/**
 * Modal para cargar una venta real en Medianube-Ventas (POST /ventas).
 * Usa <dialog> nativo, igual que el resto de la app.
 */
export default function FormularioVenta({ open, productos, onClose, onGuardada }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const opciones = productos.length > 0 ? productos : CATALOGO_VENTAS;

  const [fecha, setFecha] = useState(isoLocal(new Date()));
  const [productoID, setProductoID] = useState(opciones[0]?.productoID ?? "");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fase, setFase] = useState<"venta" | "prediccion">("venta");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const lista = productos.length > 0 ? productos : CATALOGO_VENTAS;
    setFecha(isoLocal(new Date()));
    setProductoID(lista[0]?.productoID ?? "");
    setCantidad("");
    setError(null);
    setFase("venta");
  }, [open, productos]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const unidades = Number(cantidad);
    if (!fecha) {
      setError("Elegí una fecha.");
      return;
    }
    if (!productoID) {
      setError("Elegí un producto.");
      return;
    }
    if (!Number.isFinite(unidades) || unidades <= 0) {
      setError("La cantidad tiene que ser un número mayor a 0.");
      return;
    }

    setGuardando(true);
    setFase("venta");
    setError(null);
    try {
      await guardarVenta({ fecha, productoID, cantidad: unidades, origen: "manual" });
      const nombre = opciones.find((p) => p.productoID === productoID)?.nombre ?? productoID;
      setFase("prediccion");
      let prediccionOk = true;
      try {
        await recalcularDemanda();
      } catch {
        prediccionOk = false;
      }
      onGuardada({ nombre, cantidad: unidades, fecha, prediccionOk });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la venta.");
    } finally {
      setGuardando(false);
      setFase("venta");
    }
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="venta-titulo"
      onCancel={(e) => {
        e.preventDefault();
        if (!guardando) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !guardando) onClose();
      }}
    >
      <h2 id="venta-titulo">Registrar venta</h2>
      <p className="dialog-text">Se guarda en el historial y se vuelve a calcular la predicción de abajo.</p>

      <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        <label style={campo}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)" }}>Fecha</span>
          <input
            id="venta-fecha"
            type="date"
            className="input"
            value={fecha}
            max={isoLocal(new Date())}
            onChange={(e) => setFecha(e.target.value)}
            disabled={guardando}
            required
          />
        </label>

        <label style={campo}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)" }}>Producto</span>
          <select
            id="venta-producto"
            className="input"
            value={productoID}
            onChange={(e) => setProductoID(e.target.value)}
            disabled={guardando}
            required
          >
            {opciones.map((p) => (
              <option key={p.productoID} value={p.productoID}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label style={campo}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)" }}>Cantidad vendida</span>
          <input
            id="venta-cantidad"
            type="number"
            className="input"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="ej. 24"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            disabled={guardando}
            required
          />
        </label>

        {error && (
          <p role="alert" className="field-error" style={{ margin: 0 }}>
            {error}
          </p>
        )}

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={guardando}>
            cancelar
          </Button>
          <Button id="btn-guardar-venta" type="submit" variant="primary" disabled={guardando}>
            {guardando ? (fase === "prediccion" ? "actualizando predicción…" : "guardando…") : "guardar venta"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
