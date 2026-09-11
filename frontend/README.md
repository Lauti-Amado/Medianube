## 💻 Setup Local (Developer Experience)

Para levantar el entorno de desarrollo del frontend (NextJS) en tu computadora local, seguí estos pasos:

1. **Clonar el repositorio:**
   `git clone https://github.com/TU-USUARIO/Medianube.git`
   `cd Medianube/frontend`

2. **Instalar dependencias:**
   `npm install`

3. **Variables de Entorno:**
   Duplicar el archivo `.env.example` (si existe) y renombrarlo a `.env.local`. Solicitar las claves de API (AWS, Auth) al equipo de DevOps/Integraciones.

4. **Ejecutar el servidor de desarrollo:**
   `npm run dev`

El proyecto estará disponible en `http://localhost:3000`.