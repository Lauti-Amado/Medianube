## 💻 Setup Local (Frontend — Next.js 15)

Requisitos: **Node.js 22+** y npm.

1. **Clonar el repositorio e ingresar al frontend:**
   ```bash
   git clone [https://github.com/lauti-amado/Medianube.git](https://github.com/lauti-amado/Medianube.git)
   cd Medianube/frontend
   ```

2. **Instalar dependencias:**
   ```bash
   npm ci
   ```

3. **Variables de entorno (opcionales en desarrollo):**
   Por defecto el cliente apunta a la HTTP API de producción (`1i2vqeifsi`) y a la distribución de CloudFront (`d2nm15i6i0na2r.cloudfront.net`). Si necesitás apuntar a otro entorno, creá un archivo `.env.local` con:
   ```env
   NEXT_PUBLIC_API_URL=[https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com](https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com)
   NEXT_PUBLIC_CDN_URL=[https://d2nm15i6i0na2r.cloudfront.net](https://d2nm15i6i0na2r.cloudfront.net)
   ```

4. **Ejecutar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   La aplicación queda disponible en `http://localhost:3000`.

## 🧪 Scripts útiles

- `npm test` — corre los 36 tests unitarios (`lib/*.test.ts`).
- `npm run lint` — verifica reglas de ESLint y TypeScript.
- `npm run build` — genera el build de producción de Next.js.

Para desplegar cambios en la instancia EC2 de producción, seguir [`docs/REDESPLEGAR.md`](../docs/REDESPLEGAR.md).