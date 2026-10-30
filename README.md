# Databricks Master Training: Análisis de Clientes y Churn

![Arquitectura del Master Training en la plataforma Databricks](assets/arquitetura.gif?v=20260928)

Entrenamiento práctico (hands-on) en la plataforma Databricks que lleva al participante desde el SQL self-service hasta los agentes de IA, siempre sobre un mismo desafío de negocio: entender y reducir el churn (cancelación) de clientes.

## Objetivo

Capacitar a equipos de negocio y de datos para usar la plataforma Databricks de punta a punta, en modo **low-code**, y responder una pregunta real: *¿por qué los clientes cancelan y cómo retenerlos?*

A lo largo de la ruta, el participante:
- consulta y modela datos de churn (SQL, Metric Views);
- aplica IA Generativa sobre texto (tickets de soporte);
- crea dashboards y agentes conversacionales (Genie);
- entrena un modelo de churn y lo sirve con gobernanza;
- orquesta todo en un agente Supervisor y entrega una app de retención.

El dominio es una empresa de suscripción genérica, por lo que la ruta se adapta a cualquier cliente o industria. Todo el contenido es reproducible en cualquier workspace: los datos vienen de CSV versionados en este repositorio.

## Arquitectura de datos

- **Base compartida** (schema `churn`, solo lectura): se crea una vez en el Setup y la usa toda la clase.
- **Schema personal por participante** (`<catálogo>.<tu_database>`): recibe lo que cada uno crea en los ejercicios (metric views, modelo, funciones, etc.).
- Los objetos de workspace (Genie, Supervisor, App) se crean por participante.

<details markdown="1">
<summary>👉 Tablas de la base compartida churn</summary>

| Objeto | Tipo | Contenido |
|--------|------|----------|
| `dim_cliente`, `dim_plan`, `dim_fecha` | Dimensiones | Cliente, plan y calendario |
| `hecho_suscripcion`, `hecho_uso`, `hecho_facturacion`, `hecho_ticket_soporte` | Hechos | Suscripciones, uso, facturación y tickets de soporte |
| `feature_churn` | Tabla analítica | Una fila por cliente, lista para análisis y ML |
| `kb_volume` | Volumen | Base de conocimiento: FAQ, Política de Retención, Playbook de CS |

</details>

## Ruta de aprendizaje

| Módulo | Contenido |
|--------|-----------|
| **00 - Setup y teardown** | Preparación de la base compartida de churn (datos + documentación + base de conocimiento). Empieza por aquí. |
| **01 - SQL con IA** | Explorar la base en el SQL Editor y generar SQL con el asistente (Genie Code). |
| **02 - Generación de Alertas** | Crear alertas que se disparan cuando un indicador de churn cruza un umbral. |
| **03 - Métricas de Negocio** | Definir métricas gobernadas (churn, ingresos, soporte) y consultarlas con MEASURE(). |
| **04 - IA Generativa en SQL** | IA Generativa en SQL sobre los tickets: sentimiento, clasificación, PII y resumen. |
| **05 - Dashboards con IA** | Panel ejecutivo de churn en AI/BI, con los gráficos armados por el Asistente (✨) a partir de prompts. |
| **06 - Predicción de Churn (ML)** | Entrenar y registrar un modelo de probabilidad de churn y generar la tabla de scores que alimenta a los agentes y a la app. |
| **07 - Análisis de Datos Multi-Agent** | Crear dos Genies (Facturación y Soporte) y un agente Supervisor que los orquesta, enrutando cada pregunta al especialista correcto. |
| **08 - Retención con ML y GenAI** | Crear funciones gobernadas (UC Functions) que transforman el score en acción: el perfil 360 del cliente y un email de retención personalizado, con las reglas de oferta en SQL y la IA solo en la redacción. |
| **09 - Creación de Apps** | Publicar la **Central de Retención**: la app que integra todo el entrenamiento. Reúne el Cockpit de churn (mapa + gráficos con lectura por IA), el Asistente (el Supervisor del Ej. 7) y la Retención personalizada (las funciones del Ej. 8), con un único notebook de deploy. La IA de la app pasa por un **model service del Unity Gateway**, gobernado y auditado. |
| **10 - Cierre (Próximos Pasos)** | Retrospectiva del desafío de churn completado, resumen de todo lo construido y los próximos pasos en la Databricks Academy (Jornada Lakehouse). |

## Cómo empezar

Abre la carpeta **[`00 - Setup y teardown`](./00%20-%20Setup%20y%20teardown)** y sigue el `README.md` que está ahí.
