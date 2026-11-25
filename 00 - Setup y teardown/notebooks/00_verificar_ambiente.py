# Databricks notebook source
# MAGIC %md
# MAGIC # From Zero to Hero · ✅ Verificación de ambiente (participante)
# MAGIC
# MAGIC ### ¡Hola! Gracias por sumarte al entrenamiento.
# MAGIC
# MAGIC Este notebook tiene **un solo trabajo**: confirmar que **tu usuario** tiene todo lo necesario
# MAGIC para el día del evento. Tarda **unos 3 minutos** y, si algo falta, te dice exactamente qué hacer.
# MAGIC
# MAGIC > 🔒 **No modifica nada que no sea tuyo.** Crea tu schema personal (tu espacio de trabajo para
# MAGIC > todo el curso) y una tabla de prueba que **borra al terminar**.
# MAGIC
# MAGIC ### Antes de empezar
# MAGIC Tu administrador ya ejecutó el **Setup** (`00_setup`). Si no sabes si lo hizo, pregúntale:
# MAGIC sin el Setup, casi todas las verificaciones salen en rojo.
# MAGIC
# MAGIC ### ¿Qué es un notebook? (si es tu primera vez en Databricks)
# MAGIC Un **notebook** es una página con **celdas**. Algunas celdas tienen texto (como esta) y otras
# MAGIC tienen código. Ejecutar una celda significa pedirle a Databricks que haga lo que dice el código.
# MAGIC No necesitas entender el código: solo seguir los pasos.

# COMMAND ----------

# MAGIC %md
# MAGIC ## ▶️ Cómo usarlo (4 pasos)
# MAGIC
# MAGIC 1. **Conecta el notebook a un cómputo.** Arriba a la derecha hay un botón **Connect**
# MAGIC    (o el nombre de un cómputo). Haz clic y elige **`fromzerotohero_workshop_cluster`**.
# MAGIC    Si no aparece, elige **Serverless**.
# MAGIC    > El **cómputo** es la "máquina" que ejecuta el código. Sin cómputo, el notebook no corre.
# MAGIC 2. **Ejecuta la celda del Paso 0** (haz clic dentro de ella y presiona **Shift + Enter**).
# MAGIC    Aparece un campo **Tu schema** arriba del notebook.
# MAGIC 3. **Escribe tu schema**: la 1.ª letra de tu nombre + tu primer apellido, en minúsculas y sin
# MAGIC    acentos. Ejemplo: *Gabriel García* → `ggarcia`. **Anótalo**: lo vas a usar en todos los módulos.
# MAGIC 4. Haz clic en **Run all** (arriba a la derecha) y espera. Al final aparece tu **resultado**:
# MAGIC
# MAGIC | | Significa |
# MAGIC |---|---|
# MAGIC | 🟢 **Listo** | Tienes todo. ¡Nos vemos en el evento! |
# MAGIC | 🟡 **Listo con avisos** | Puedes participar; algún ejercicio puede quedar limitado. |
# MAGIC | 🔴 **Falta algo** | Hay que resolverlo antes del evento (la tabla te dice qué pedirle a tu administrador). |
# MAGIC
# MAGIC 5. **Copia el bloque de resumen del final** y envíalo a tu administrador o a tu instructor,
# MAGIC    aunque todo salga en verde. Así sabemos que estás listo.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 0 — Tu schema

# COMMAND ----------

dbutils.widgets.text("schema", "", "Tu schema")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 1 — Preparación (no necesitas hacer nada aquí)
# MAGIC Esta celda lee tu schema, se conecta a Databricks con **tu identidad** y prepara la lista de
# MAGIC resultados.

# COMMAND ----------

import re, time
from databricks.sdk import WorkspaceClient

CATALOG = "fromzerotohero"
SHARED = f"{CATALOG}.churn"
WAREHOUSE_NAME = "fromzerotohero_workshop_wh"
SCHEMA = re.sub(r"[^a-z0-9_]", "", dbutils.widgets.get("schema").strip().lower())
assert SCHEMA, "Escribe tu schema en el campo 'Tu schema' (ej.: ggarcia) y vuelve a hacer clic en Run all."

w = WorkspaceClient()
ME = w.current_user.me().user_name
# URL real del workspace (en un cluster clásico, w.config.host es el host regional, no el del workspace).
try:
    HOST = "https://" + spark.conf.get("spark.databricks.workspaceUrl")
except Exception:
    HOST = w.config.host.rstrip("/")
RESULTADOS = []   # (área, verificación, estado, qué hacer)

def registrar(area, nombre, estado, que_hacer=""):
    if estado == "🟢":
        que_hacer = ""
    RESULTADOS.append((area, nombre, estado, que_hacer))
    print(f"{estado} {area} · {nombre}" + (f"\n     → {que_hacer}" if estado != "🟢" and que_hacer else ""))

print(f"Usuario: {ME}\nSchema : {CATALOG}.{SCHEMA}\nWorkspace: {HOST}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 2 — Datos del curso (Unity Catalog)
# MAGIC **Unity Catalog** es el lugar donde Databricks organiza y protege todos los datos. Cada dato tiene
# MAGIC una dirección de tres partes: **catálogo → schema → tabla** (por ejemplo `fromzerotohero.churn.dim_cliente`).
# MAGIC
# MAGIC Verificamos que puedes **leer** la base compartida del curso y **crear tu propio schema**.

# COMMAND ----------

try:
    n = spark.sql(f"SELECT COUNT(*) AS n FROM {SHARED}.dim_cliente").first()["n"]
    registrar("Datos", "Leer la base compartida fromzerotohero.churn", "🟢" if n == 2000 else "🟡",
              f"Se esperaban 2000 clientes y hay {n}: pide al administrador que vuelva a ejecutar el Setup.")
except Exception as e:
    registrar("Datos", "Leer la base compartida fromzerotohero.churn", "🔴",
              "Pide al administrador que ejecute el Setup y que te agregue a los participantes "
              f"(grupo fromzerotohero_workshop). Detalle: {str(e)[:120]}")

try:
    spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA}")
    spark.sql(f"CREATE OR REPLACE TABLE {CATALOG}.{SCHEMA}._verificacion AS SELECT 1 AS ok")
    spark.sql(f"DROP TABLE {CATALOG}.{SCHEMA}._verificacion")
    registrar("Datos", f"Crear tu schema {CATALOG}.{SCHEMA} y tablas en él", "🟢")
except Exception as e:
    registrar("Datos", f"Crear tu schema {CATALOG}.{SCHEMA} y tablas en él", "🔴",
              "Pide al administrador el permiso CREATE SCHEMA en el catálogo fromzerotohero "
              f"(lo da el Setup). Detalle: {str(e)[:120]}")

try:
    archivos = dbutils.fs.ls(f"/Volumes/{CATALOG}/churn/kb_volume")
    registrar("Datos", "Leer la base de conocimiento (volumen kb_volume)", "🟢" if archivos else "🟡",
              "El volumen está vacío: pide al administrador que vuelva a ejecutar el Setup.")
except Exception as e:
    registrar("Datos", "Leer la base de conocimiento (volumen kb_volume)", "🟡",
              f"Se usa solo como material de apoyo. Detalle: {str(e)[:100]}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 3 — SQL Warehouse y AI Functions
# MAGIC Un **SQL Warehouse** es el motor que ejecuta tus consultas SQL en el **SQL Editor**, los
# MAGIC **dashboards** y las **alertas**. Las **AI Functions** son funciones SQL que llaman a un modelo
# MAGIC de IA (por ejemplo, para leer el sentimiento de un texto).
# MAGIC
# MAGIC Probamos el warehouse del curso con una consulta real que usa IA.

# COMMAND ----------

from databricks.sdk.service.sql import StatementState

def sql_warehouse(stmt, wh_id, espera_s=120):
    r = w.statement_execution.execute_statement(statement=stmt, warehouse_id=wh_id, wait_timeout="30s")
    t0 = time.time()
    while r.status.state in (StatementState.PENDING, StatementState.RUNNING) and time.time() - t0 < espera_s:
        time.sleep(3)
        r = w.statement_execution.get_statement(r.statement_id)
    if r.status.state != StatementState.SUCCEEDED:
        raise RuntimeError((r.status.error.message if r.status.error else str(r.status.state))[:200])
    return r.result.data_array if r.result else []

WH = next((x for x in w.warehouses.list() if x.name == WAREHOUSE_NAME), None)
if not WH:
    registrar("SQL", f"SQL Warehouse '{WAREHOUSE_NAME}' visible", "🔴",
              "Pide al administrador el permiso CAN USE en el warehouse (lo da el Setup).")
else:
    try:
        sql_warehouse("SELECT 1", WH.id)
        registrar("SQL", f"Usar el SQL Warehouse '{WAREHOUSE_NAME}'", "🟢")
    except Exception as e:
        registrar("SQL", f"Usar el SQL Warehouse '{WAREHOUSE_NAME}'", "🔴",
                  f"Pide al administrador el permiso CAN USE en el warehouse. Detalle: {e}")
    try:
        v = sql_warehouse("SELECT ai_analyze_sentiment('El servicio fue excelente, muy rápido')", WH.id)
        registrar("IA", "AI Functions en SQL (ai_analyze_sentiment, Ej. 4)", "🟢" if v else "🟡")
    except Exception as e:
        registrar("IA", "AI Functions en SQL (ai_analyze_sentiment, Ej. 4)", "🔴",
                  f"Las AI Functions no están disponibles en esta región o workspace: avisa al instructor. Detalle: {e}")
    for ep in ["databricks-meta-llama-3-3-70b-instruct", "databricks-gpt-oss-120b"]:
        try:
            sql_warehouse(f"SELECT ai_query('{ep}', 'Responde solo: OK')", WH.id)
            registrar("IA", f"ai_query con el modelo {ep} (Ej. 4 y 8)", "🟢")
        except Exception as e:
            registrar("IA", f"ai_query con el modelo {ep} (Ej. 4 y 8)", "🟡",
                      f"Este modelo no responde: en el ejercicio usa otro de la lista. Detalle: {e}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 4 — Genie, Apps y Unity Gateway
# MAGIC - **Genie Agents**: agentes que responden preguntas de negocio en español, escribiendo el SQL por ti (Ej. 7).
# MAGIC - **Databricks Apps**: aplicaciones web que Databricks aloja por ti (Ej. 9).
# MAGIC - **Unity Gateway**: la puerta gobernada para usar modelos de IA, con límites y registro (Ej. 9).

# COMMAND ----------

def api_ok(method, path, body=None):
    try:
        w.api_client.do(method, path, body=body)
        return True, ""
    except Exception as e:
        return False, str(e)[:150]

ok, err = api_ok("GET", "/api/2.0/genie/spaces?page_size=1")
registrar("Agentes", "Genie Agents disponibles (Ej. 5, 7 y 9)", "🟢" if ok else "🔴",
          f"Pide al administrador habilitar Genie en el workspace. Detalle: {err}")

ok, err = api_ok("GET", "/api/2.0/apps?page_size=1")
registrar("Apps", "Databricks Apps disponible (Ej. 9)", "🟢" if ok else "🔴",
          f"Pide al administrador habilitar Databricks Apps en el workspace. Detalle: {err}")

# El Unity Gateway responde en la URL del workspace (HOST), con tu identidad.
import requests
try:
    _r = requests.post(f"{HOST}/ai-gateway/mlflow/v1/chat/completions", timeout=60,
                       headers={**w.config.authenticate(), "Content-Type": "application/json"},
                       json={"model": "system.ai.gpt-oss-20b", "max_tokens": 200,
                             "messages": [{"role": "user", "content": "Responde solo: OK"}]})
    ok, err = _r.status_code == 200, f"HTTP {_r.status_code}: {_r.text[:120]}"
except Exception as e:
    ok, err = False, str(e)[:150]
registrar("IA", "Usar modelos del Unity Gateway (system.ai.gpt-oss-20b, Ej. 9)", "🟢" if ok else "🟡",
          f"Pide al administrador el permiso EXECUTE en system.ai (lo da el Setup). Detalle: {err}")

registrar("Agentes", "Genie One: ábrelo una vez para confirmar el acceso", "🟡",
          f"Abre {HOST}/one en otra pestaña. Si ves la pantalla de Genie One, todo bien.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## ✅ Resultado
# MAGIC Copia el bloque de texto de abajo y envíalo a tu administrador o instructor.

# COMMAND ----------

import pandas as pd

rojos = [r for r in RESULTADOS if r[2] == "🔴"]
amarillos = [r for r in RESULTADOS if r[2] == "🟡" and not r[1].startswith("Genie One")]
veredicto = "🔴 FALTA ALGO" if rojos else ("🟡 LISTO CON AVISOS" if amarillos else "🟢 LISTO")

display(pd.DataFrame(RESULTADOS, columns=["Área", "Verificación", "Estado", "Qué hacer"]))

lineas = [
    "From Zero to Hero · Verificación de ambiente",
    f"Usuario   : {ME}",
    f"Schema    : {CATALOG}.{SCHEMA}",
    f"Workspace : {HOST}",
    f"Resultado : {veredicto}",
    "-" * 50,
] + [f"{e} {a} · {n}" for a, n, e, _ in RESULTADOS]
print("\n".join(lineas))
