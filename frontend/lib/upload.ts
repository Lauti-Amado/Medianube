// Subida de facturas a S3 mediante presigned URLs.
// 1) Se pide a la API (Lambda) una URL firmada para un archivo puntual.
// 2) El navegador sube el archivo directo a S3 con esa URL (PUT).

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com";

// Mientras no exista la ruta /uploads/presign se puede simular la subida.
const MOCK_UPLOAD = process.env.NEXT_PUBLIC_UPLOAD_MOCK === "true";

interface PresignResponse {
  uploadUrl: string;
  key: string;
}

async function requestPresignedUrl(file: File, idToken?: string): Promise<PresignResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) headers.Authorization = idToken;

  const response = await fetch(`${API_URL}/uploads/presign`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
  });
  if (!response.ok) throw new Error("No se pudo obtener la URL de subida.");
  return response.json();
}

// Se usa XMLHttpRequest en lugar de fetch porque fetch no informa el progreso de subida.
function putToS3(uploadUrl: string, file: File, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type); // debe coincidir con el firmado
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Falló la subida a S3."));
    xhr.onerror = () => reject(new Error("Falló la subida a S3."));
    xhr.send(file);
  });
}

function simulateUpload(file: File, onProgress?: (percent: number) => void): Promise<string> {
  return new Promise((resolve) => {
    let percent = 0;
    const timer = setInterval(() => {
      percent = Math.min(percent + 20, 100);
      onProgress?.(percent);
      if (percent === 100) {
        clearInterval(timer);
        resolve(`facturas/mock/${file.name}`);
      }
    }, 250);
  });
}

/** Sube la factura a S3 y devuelve la key con la que quedó guardada. */
export async function uploadInvoice(
  file: File,
  options: { idToken?: string; onProgress?: (percent: number) => void } = {}
): Promise<string> {
  if (MOCK_UPLOAD) return simulateUpload(file, options.onProgress);

  const { uploadUrl, key } = await requestPresignedUrl(file, options.idToken);
  await putToS3(uploadUrl, file, options.onProgress);
  return key;
}
