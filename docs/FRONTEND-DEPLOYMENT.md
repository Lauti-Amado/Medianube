# Análisis de Arquitectura: Despliegue del Frontend (EC2 vs PaaS)

## 1. Contexto
Para el frontend desarrollado en Next.js, la cátedra sugiere el uso de plataformas PaaS como Vercel o AWS Amplify para minimizar la carga operativa. Sin embargo, el equipo evaluó alojar la aplicación directamente en una instancia de AWS EC2 (IaaS).

## 2. Análisis Comparativo
*   **PaaS (Vercel / Amplify):** Despliegue automático (CI/CD nativo), nula gestión de infraestructura y excelente integración con Next.js. Desventaja: Menor control sobre el entorno de ejecución de Node.js y *vendor lock-in* fuerte en la capa de presentación.
*   **IaaS (AWS EC2):** Requiere configuración manual (Nginx, PM2, certificados SSL, actualizaciones del SO), aumentando la carga operativa inicial. Ventaja: Control absoluto del entorno, facturación predecible y centralización de todos los recursos en la misma Nube Privada Virtual (VPC) de AWS.

## 3. Decisión Arquitectónica
El equipo decide **utilizar AWS EC2 para el despliegue del frontend**.

**Justificación:**
Aunque EC2 incrementa temporalmente la carga operativa inicial al requerir configuración manual, decidimos asumir ese *trade-off* para mantener la soberanía total sobre la infraestructura. Centralizar tanto el frontend como el backend (AWS Lambda, S3, DynamoDB) dentro del mismo proveedor y red virtual simplifica la gestión de roles de seguridad (IAM) y evita depender de las cuotas comerciales de plataformas PaaS de terceros. El entorno se gestionará de forma directa utilizando PM2 para garantizar la resiliencia del proceso.