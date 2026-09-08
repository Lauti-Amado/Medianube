Medianube

***Integrantes:*** Amado Lautaro, Cáceres Juan, Figueira Julián, Piquet Leonel, Tundis Yamil

**Nombre del proyecto:** Medianube

**Descripción del problema:** El problema principal es que un negocio suele operar de manera ineficiente porque carga mucha información al sistema (facturas, stock, ventas) pero no la analiza de forma automática. Nuestra propuesta para solucionar esto es que, integrando IA, el negocio pueda predecir comportamientos futuros, saber exactamente qué producir (cruzando el stock actual, las ventas históricas y el clima) y consultar cualquier dato necesario directamente a la base de datos de forma sencilla. 

**Propuesta de valor:** Solución integral en formato SaaS para negocios gastronómicos que, mediante Inteligencia Artificial, la plataforma automatiza el día a día: gestiona las compras analizando automáticamente las facturas, sugiere precios de venta para no perder rentabilidad frente a la inflación, y predice la demanda futura de producción.

**Usuarios objetivo:** Dueños, administradores y encargados de la producción en panaderías, confiterías y negocios gastronómicos que buscan optimizar su flujo de trabajo, reducir desperdicios y proteger su rentabilidad sin contar con conocimientos contables.

**Stack tentativo:** La arquitectura propuesta se fundamenta en los requisitos de escalabilidad y costos exigidos para una solución de nube:

* **Frontend:** Despliegue de aplicación utilizando AWS EC2.  
* **Backend / API:** Cómputo Serverless mediante funciones (AWS Lambda	) para garantizar elasticidad.  
* **Persistencia de Datos:** Base de datos gestionada nativa de la nube (DynamoDB o RDS).  
* **Storage de Archivos:** Almacenamiento de objetos para las imágenes de las facturas en AWS S3.  
* **Autenticación:** Servicios gestionados de identidad (Clerk, Auth0 o AWS Cognito).  
* **Servicios Gestionados de IA:** Amazon Textract u OpenAI Vision para la lectura de tickets (OCR), y modelos LLM (OpenAI/Claude) para el cruce de variables y sugerencias de producción.
