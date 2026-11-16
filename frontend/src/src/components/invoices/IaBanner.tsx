// IaBanner — resumen de lo que leyó la IA en la factura

import Alert from "../ui/Alert";

interface Props {
  productCount: number;
  total: string;
  /** Ítems que la IA marcó con confianza baja. Solo cuando el backend informa la confianza. */
  lowConfidence?: number;
}

export default function IaBanner({ productCount, total, lowConfidence = 0 }: Props) {
  return (
    <Alert id="invoice-ia-banner" tone="ia">
      La IA leyó <strong>{productCount === 1 ? "1 producto" : `${productCount} productos`}</strong> por{" "}
      <strong>{total}</strong>.{" "}
      {lowConfidence > 0 ? (
        <>
          <strong style={{ color: "var(--color-warning-text)" }}>
            {lowConfidence === 1 ? "1 producto tiene confianza baja" : `${lowConfidence} productos tienen confianza baja`}
          </strong>
          : compará esas filas con la factura.
        </>
      ) : (
        "Compará los datos con la factura antes de darla por buena."
      )}
    </Alert>
  );
}
