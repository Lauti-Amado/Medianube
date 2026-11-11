// backend/scripts/stress-test-sqs.mjs
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

// Configuración de AWS SDK (Asume credenciales configuradas en el entorno local)
const s3 = new S3Client({ region: "us-east-2" }); // Ajusta la región si es diferente
const BUCKET_NAME = "medianube-s3-bucket"; // El nombre de tu bucket
const CANTIDAD_TICKETS = 15; // Número de facturas concurrentes a simular
const USUARIO_ID = "test-stress-user";

async function subirFacturaFalsa(index) {
  const fileName = `facturas/${USUARIO_ID}/stress-test-${Date.now()}-${randomUUID()}.jpg`;
  
  // Creamos un buffer vacío o con texto para simular la imagen. 
  // Nota: Gemini fallará al leerlo, pero SQS encolará el evento igual, que es lo que queremos probar.
  const dummyContent = Buffer.from("Esto es un ticket de prueba para estrés", "utf-8");

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: dummyContent,
    ContentType: "image/jpeg"
  });

  try {
    await s3.send(command);
    console.log(`[${index + 1}/${CANTIDAD_TICKETS}] Subido: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`[${index + 1}/${CANTIDAD_TICKETS}] Error subiendo:`, error.message);
    return false;
  }
}

async function runStressTest() {
  console.log(`Iniciando prueba de estrés: Subiendo ${CANTIDAD_TICKETS} facturas simultáneas a S3...`);
  const startTime = Date.now();

  // Ejecutamos las promesas en paralelo para saturar el ingreso
  const promesas = Array.from({ length: CANTIDAD_TICKETS }).map((_, i) => subirFacturaFalsa(i));
  
  await Promise.all(promesas);

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\nPrueba finalizada. ${CANTIDAD_TICKETS} archivos subidos en ${duration} segundos.`);
  console.log(`Ahora revisa la consola de SQS para ver los "Mensajes en vuelo" (Messages in flight).`);
  console.log(`Luego revisa los logs de la Lambda 'procesarFactura' para ver cómo se procesan uno a uno (Size = 1).`);
}

runStressTest();