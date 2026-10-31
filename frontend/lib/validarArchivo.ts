// Validación de comprobantes antes de subirlos a S3.
// No alcanza con la extensión ni con file.type (se pueden falsear),
// así que también se leen los primeros bytes del archivo (magic numbers).

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

// Valor para el atributo accept del input de archivo
export const ACCEPT_ATTR = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ...ACCEPTED_TYPES].join(",");

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.slice(start, end));

/** Devuelve el tipo real según los primeros bytes, o null si no es uno aceptado. */
function detectarTipo(bytes: Uint8Array): string | null {
  if (ascii(bytes, 0, 4) === "%PDF") return "application/pdf";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Devuelve un mensaje de error en español, o null si el archivo es válido. */
export async function validarArchivo(file: File): Promise<string | null> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Formato no soportado. Subí un PDF, PNG, JPG o WEBP.";
  }
  if (file.size > MAX_FILE_BYTES) return "El archivo supera los 10 MB.";
  if (file.size === 0) return "El archivo está vacío.";

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const tipoReal = detectarTipo(bytes);
  if (!tipoReal) return "El archivo está dañado o no es un PDF ni una imagen válida.";
  if (tipoReal !== file.type) return "El contenido del archivo no coincide con su extensión.";

  return null;
}
