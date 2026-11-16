/**
 * Formato único de moneda (plan 0.9): `$1.318`, sin espacio y sin decimales.
 * Los centavos no aportan en precios de panadería y ensucian las columnas.
 */
export function formatMoneda(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  const abs = Math.abs(valor).toLocaleString("es-AR", { maximumFractionDigits: 0 });
  return (valor < 0 ? "−$" : "$") + abs;
}
