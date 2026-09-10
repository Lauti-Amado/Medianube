# Análisis de Arquitectura: Por qué descartamos Docker en Medianube

## 1. Contexto y Problema
El Trabajo Práctico Integrador consiste en diseñar un MVP funcional bajo el modelo SaaS, priorizando la Inteligencia Artificial (IA) como diferenciador de negocio y el uso de servicios gestionados para minimizar la carga operativa. El equipo evaluó si convenía adoptar una arquitectura basada en contenedores (Docker) para las capas de Frontend y Backend, o apoyarse en modelos Serverless / PaaS.

## 2. Análisis por Capa de Aplicación

### A. Capa de Backend / API
*   **Si usáramos Docker (Amazon ECS / Fargate):** Tendríamos control total sobre el entorno de ejecución y evitaríamos la dependencia del proveedor (*vendor lock-in*). Sin embargo, el equipo tendría que utilizar redes virtuales (VPC), configurar balanceadores de carga (ALB), mantener repositorios de imágenes (ECR) y preparar y hacer el seguimiento de los despliegues. Además, un clúster encendido genera costos fijos.
*   **Decisión (AWS Lambda):** Elegimos Serverless. Nos permite escalar de cero a miles de peticiones pagando solo por milisegundo de uso. Eliminando la administración de servidores, permitiendo al equipo concentrar sus horas en el desarrollo de los algoritmos de IA (OCR y predicción).

### B. Capa de Frontend
*   **Si usáramos Docker:** Empaquetar NextJS en un contenedor requeriría un pipeline de CI/CD pesado (construir la imagen, subirla al registry, y desplegarla en un orquestador). Para nuestro equipo de 5 personas con tiempo limitado, esto sumaría tareas innecesarias en cada actualización.
*   **Decisión (PaaS / EC2 Directo):** La cátedra sugiere el uso de plataformas PaaS (como Vercel o AWS Amplify) para el frontend. Aunque alojemos nuestro NextJS en una instancia EC2, ejecutarlo directamente (vía PM2 o Node) resulta mucho más rápido y directo que gestionar el ciclo de vida de un contenedor solo para la interfaz web.

## 3. Conclusión Arquitectónica
**El equipo descarta el uso de Docker y contenedores para cualquier componente del proyecto.**

**Justificación final:**
1. **Tiempo de mercado** (**Time-to-Market crítico**): El calendario exige una pre-entrega (Checkpoint 2) para el 09/11 y la defensa final en producción el 30/11. Configurar la infraestructura de contenedores podría comprometer estos plazos.
2. **Alineación Estratégica:** El objetivo del proyecto no es demostrar habilidades de infraestructura pura, sino construir un producto inteligente donde la IA sea el núcleo. Rechazar Docker es una decisión que permitirá reducir la carga operativa y utilizar el esfuerzo del equipo en la integración de modelos de lenguaje y visión artificial.
