# Databricks notebook source
# MAGIC %md
# MAGIC # Ejercicio 9 — Publicar la Central de Retención (Databricks App)
# MAGIC
# MAGIC Este notebook **publica tu app** *Central de Retención*, la pantalla que une todo el curso:
# MAGIC
# MAGIC | Pestaña | Qué usa de lo que construiste |
# MAGIC |---|---|
# MAGIC | 📊 **Cockpit** | la tabla `churn_scores` (Ej. 6) + la base `fromzerotohero.churn` |
# MAGIC | 💬 **Asistente** | tus Genie Agents de **Facturación** y **Soporte** (Ej. 7) |
# MAGIC | 🎯 **Retención** | tu función `get_cliente_360` (Ej. 8) |
# MAGIC
# MAGIC **No escribes código y no otorgas ningún permiso a mano.** Solo completas un campo y haces clic
# MAGIC en **Run all**. El notebook hace el resto y, al final, te muestra el enlace de tu app.
# MAGIC
# MAGIC ### Conceptos de este ejercicio
# MAGIC - **Databricks App**: una aplicación web que Databricks aloja por ti (con su propio cómputo y
# MAGIC   una URL). No necesitas servidores ni configurar nada de infraestructura.
# MAGIC - **On-behalf-of (OBO)**: la app actúa **con tu identidad**. Cuando abres la app, Databricks te
# MAGIC   pide autorizarla; desde ahí, cada consulta y cada llamada de IA se ejecuta como **tú**, con tus
# MAGIC   permisos. Por eso no hay que otorgarle permisos a la app.
# MAGIC - **Model service del Unity Gateway**: un modelo de IA registrado en **tu schema** de Unity
# MAGIC   Catalog, con dueño, límite de uso (60 llamadas por minuto) y una tabla que registra cada llamada.
# MAGIC   Así una empresa pone IA en producción con gobernanza.
# MAGIC
# MAGIC **Requisitos previos** (en tu schema `fromzerotohero.<tu_schema>`):
# MAGIC - **Ej. 6**: la tabla `churn_scores`.
# MAGIC - **Ej. 7**: tus Genie Agents `Facturación - <tu_schema>` y `Soporte - <tu_schema>`.
# MAGIC - **Ej. 8**: la función `get_cliente_360`.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 1 — Completa los campos
# MAGIC 1. Ejecuta **solo la celda de abajo** (haz clic dentro de ella y presiona **Shift + Enter**).
# MAGIC    Aparecen unos campos en la parte superior del notebook.
# MAGIC 2. En **1. Tu schema**, escribe el nombre de tu schema (el que creaste en el Ej. 1, por ejemplo `ggarcia`).
# MAGIC 3. Los demás campos ya vienen completos. Déjalos como están, salvo que tu instructor te indique otra cosa:
# MAGIC    - **2. Warehouse**: el SQL Warehouse del curso (`fromzerotohero_workshop_wh`).
# MAGIC    - **3. Model service**: el nombre del modelo que se va a crear en tu schema (`retencion-gateway`).
# MAGIC    - **4 y 5. ID de tus Genies**: déjalos **vacíos**. El notebook encuentra tus Genies solo,
# MAGIC      por el nombre que les diste en el Ej. 7. Si les pusiste otro nombre, pega aquí su ID
# MAGIC      (Genie Agent → **Configure → Settings**).
# MAGIC 4. Haz clic en **Run all** (arriba a la derecha).

# COMMAND ----------

# Crea los campos (widgets) en la parte superior del notebook.
from databricks.sdk import WorkspaceClient as _WC
try:
    _wh_names = [x.name for x in _WC().warehouses.list()]
except Exception:
    _wh_names = []  # sin permiso para listar: el campo queda con el nombre del curso
_WH_DEFAULT = "fromzerotohero_workshop_wh"
_wh_choices = _wh_names or [_WH_DEFAULT]
_wh_sel = _WH_DEFAULT if _WH_DEFAULT in _wh_choices else _wh_choices[0]

dbutils.widgets.text("schema", "", "1. Tu schema")
dbutils.widgets.dropdown("warehouse", _wh_sel, _wh_choices, "2. Warehouse")
dbutils.widgets.text("model_service", "retencion-gateway", "3. Model service")
dbutils.widgets.text("genie_facturacion", "", "4. ID Genie Facturación (opcional)")
dbutils.widgets.text("genie_soporte", "", "5. ID Genie Soporte (opcional)")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 2 — Leer tu configuración
# MAGIC Esta celda lee los campos y muestra un resumen. Si falta tu schema, se detiene con un aviso.

# COMMAND ----------

import os, re, shutil, time, unicodedata
from databricks.sdk import WorkspaceClient

SCHEMA = dbutils.widgets.get("schema").strip()
CATALOG = "fromzerotohero"
WAREHOUSE_W = dbutils.widgets.get("warehouse").strip()
MODEL_SERVICE_NAME = dbutils.widgets.get("model_service").strip() or "retencion-gateway"
GENIE_FACT_W = dbutils.widgets.get("genie_facturacion").strip()
GENIE_SOP_W = dbutils.widgets.get("genie_soporte").strip()

assert SCHEMA, "Completa el campo '1. Tu schema' (por ejemplo: ggarcia) y vuelve a hacer clic en Run all."

w = WorkspaceClient()

# Permisos que la app pide en tu nombre (on-behalf-of):
#   sql          -> leer datos con el SQL Warehouse
#   genie        -> preguntar a tus Genie Agents
#   ai-gateway   -> usar tu model service del Unity Gateway
#   model-serving-> respaldo: foundation model si el Gateway no está disponible
USER_API_SCOPES = ["sql", "genie", "ai-gateway", "model-serving"]
EXPLAIN_MODEL = "databricks-claude-sonnet-4-5"        # respaldo si no hay model service
WAREHOUSE_NAME = "fromzerotohero_workshop_wh"              # creado en el Setup (Ej. 00)
GATEWAY_DEST_MODEL = "models/system.ai.gpt-oss-20b"   # modelo detrás de tu model service
REPO_ZIP_URL = "https://github.com/carolinaacarneiro/from-zero-to-hero-business/archive/refs/heads/main.zip"

# Nombre del app: prefijo + schema, como máximo 30 caracteres (regla de Databricks Apps).
APP_NAME = ("central-retencion-" + re.sub(r"[^a-z0-9-]", "-", SCHEMA.lower()).strip("-"))[:30].rstrip("-")
ME = w.current_user.me().user_name
GATEWAY_MODEL = f"{CATALOG}.{SCHEMA}.{MODEL_SERVICE_NAME}"

print("Participante   :", ME)
print("Tu schema      :", f"{CATALOG}.{SCHEMA}")
print("App            :", APP_NAME)
print("Model service  :", GATEWAY_MODEL)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 3 — Encontrar el SQL Warehouse
# MAGIC La app lee los datos con un **SQL Warehouse** (el motor que ejecuta SQL). Lo buscamos por nombre.

# COMMAND ----------

def resolver_warehouse():
    whs = list(w.warehouses.list())
    if not whs:
        raise RuntimeError("No hay ningún SQL Warehouse en el workspace. Pide a tu administrador que ejecute el Setup (Ej. 00).")
    for nombre in (WAREHOUSE_W, WAREHOUSE_NAME):
        m = next((x for x in whs if nombre and (x.id == nombre or x.name == nombre)), None)
        if m:
            return m.id, m.name
    m = next((x for x in whs if str(getattr(x, "state", "")).upper().endswith("RUNNING")), whs[0])
    return m.id, m.name

WH_ID, WH_NAME = resolver_warehouse()
print(f"✅ Warehouse: '{WH_NAME}' (id {WH_ID})")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 4 — Encontrar tus Genie Agents (Ej. 7)
# MAGIC El Asistente de la app pregunta a tus dos Genies. Los buscamos por el nombre que les diste:
# MAGIC `Facturación - <tu_schema>` y `Soporte - <tu_schema>`.

# COMMAND ----------

def api(method, path, body=None, query=None):
    return w.api_client.do(method, path, body=body, query=query)

def _norm(t):
    return unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower().strip()

def listar_genies():
    out, token = [], None
    for _ in range(50):
        r = api("GET", "/api/2.0/genie/spaces", query={"page_size": 100, **({"page_token": token} if token else {})})
        out += r.get("spaces") or []
        token = r.get("next_page_token")
        if not token:
            break
    return out

_GENIES = None

def buscar_genie(prefijo, id_widget):
    global _GENIES
    if id_widget:
        return id_widget, "(ID del campo)"
    if _GENIES is None:
        _GENIES = listar_genies()
    # Coincidencia exacta del título (sin tildes ni mayúsculas): "Facturación - <tu_schema>".
    objetivo = _norm(f"{prefijo} - {SCHEMA}")
    candidatos = [g for g in _GENIES if _norm(g.get("title")).replace(" ", "") == objetivo.replace(" ", "")]
    if len(candidatos) > 1:
        print(f"  aviso: hay {len(candidatos)} Genies llamados '{prefijo} - {SCHEMA}'; uso el primero. "
              "Si no es el correcto, pega su ID en el campo correspondiente.")
    if not candidatos:
        raise RuntimeError(
            f"No encontré tu Genie '{prefijo} - {SCHEMA}'. Revisa el nombre en Genie Agents (Ej. 7) "
            f"o pega su ID en el campo correspondiente (Configure → Settings).")
    return candidatos[0]["space_id"], candidatos[0].get("title")

GENIE_FACT, _t1 = buscar_genie("Facturación", GENIE_FACT_W)
GENIE_SOP, _t2 = buscar_genie("Soporte", GENIE_SOP_W)
print(f"✅ Genie de Facturación: {_t1}  (id {GENIE_FACT})")
print(f"✅ Genie de Soporte    : {_t2}  (id {GENIE_SOP})")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 5 — Crear tu model service en el Unity Gateway
# MAGIC Creamos en tu schema un **model service**: el modelo de IA que la app usa para elegir al
# MAGIC especialista del Asistente, explicar los gráficos y redactar el e-mail de retención.
# MAGIC - **Destino**: el modelo `gpt-oss-20b`, que Databricks ofrece en `system.ai`.
# MAGIC - **Límite de uso**: 60 llamadas por minuto.
# MAGIC - **Tabla de inferencia**: `retencion_gateway_payload`, que registra cada pregunta y respuesta.
# MAGIC
# MAGIC Si ya existe (porque ejecutaste el notebook antes), lo reutilizamos.

# COMMAND ----------

def _es_404(e):
    return "NotFound" in type(e).__name__ or "404" in str(e) or "does not exist" in str(e).lower()

_ms_path = f"/api/2.1/unity-catalog/model-services/{GATEWAY_MODEL}"
try:
    api("GET", _ms_path)
    print(f"✅ Model service '{GATEWAY_MODEL}' ya existe: lo reutilizamos.")
except Exception as _e:
    if not _es_404(_e):
        raise RuntimeError(f"No pude consultar el model service (no es un 'no existe'): {_e}") from _e
    api("POST", f"/api/2.1/unity-catalog/model-services?model_service_id={MODEL_SERVICE_NAME}"
                f"&parent=schemas/{CATALOG}.{SCHEMA}", body={
        "comment": "From Zero to Hero: modelo de la Central de Retención (Unity Gateway)",
        "config": {
            "routing": {"destinations": [{
                "destination_type": "DESTINATION_TYPE_PAY_PER_TOKEN_FOUNDATION_MODEL",
                "name": "primary", "traffic_percentage": 100,
                "pay_per_token_config": {"model": GATEWAY_DEST_MODEL}}]},
            "rate_limits": [{"key": "RATE_LIMIT_KEY_SERVICE",
                             "renewal_period": "RATE_LIMIT_RENEWAL_PERIOD_MINUTE", "requests": 60}],
            "inference_table": {"parent": f"schemas/{CATALOG}.{SCHEMA}",
                                "table_name_prefix": MODEL_SERVICE_NAME.replace("-", "_")},
        },
    })
    print(f"✅ Model service '{GATEWAY_MODEL}' creado.")
_ms = api("GET", _ms_path)
_dest = (_ms.get("config") or {}).get("routing", {}).get("destinations", [{}])[0]
print("   modelo destino   :", (_dest.get("pay_per_token_config") or {}).get("model"))
print("   tabla de registro:", ((_ms.get("config") or {}).get("inference_table") or {}).get("table"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 6 — Preparar el código de la app con tu configuración
# MAGIC El código de la app está en la carpeta `app/`, al lado de este notebook (si clonaste el
# MAGIC repositorio como **Git folder**). Si importaste solo el notebook, lo descargamos de GitHub.
# MAGIC Copiamos el código a una carpeta tuya y escribimos tu configuración en el archivo `app.yaml`.

# COMMAND ----------

import urllib.request, zipfile, tempfile, glob

_local = os.path.join(os.getcwd(), "app")
if os.path.isfile(os.path.join(_local, "package.json")):
    SRC_APP = _local
    print("Código de la app: carpeta local del Git folder ->", SRC_APP)
else:
    _tmp = tempfile.mkdtemp()
    _zip = os.path.join(_tmp, "repo.zip")
    try:
        urllib.request.urlretrieve(REPO_ZIP_URL, _zip)
    except Exception as e:
        raise RuntimeError(
            "No encontré la carpeta app/ junto al notebook ni pude descargarla de GitHub. "
            "Clona el repositorio como Git folder (Workspace → Create → Git folder) y abre este "
            "notebook desde ahí.") from e
    with zipfile.ZipFile(_zip) as _zf:
        _zf.extractall(_tmp)
    _matches = glob.glob(os.path.join(_tmp, "*", "09 - Creación de Apps", "app"))
    assert _matches, "El archivo descargado no tiene la carpeta app/."
    SRC_APP = _matches[0]
    print("Código de la app: descargado de GitHub ->", SRC_APP)

STAGE = f"/Workspace/Users/{ME}/.central-retencion/{APP_NAME}"
if os.path.exists(STAGE):
    shutil.rmtree(STAGE)
shutil.copytree(SRC_APP, STAGE, ignore=shutil.ignore_patterns("node_modules", "src", "__pycache__", ".venv"))

APP_YAML = f"""command:
  - "node"
  - "server/index.js"

env:
  - name: CR_WAREHOUSE_ID
    value: "{WH_ID}"
  - name: CR_GENIE_FACTURACION
    value: "{GENIE_FACT}"
  - name: CR_GENIE_SOPORTE
    value: "{GENIE_SOP}"
  - name: CR_EXPLAIN_MODEL
    value: "{EXPLAIN_MODEL}"
  - name: CR_GATEWAY_MODEL
    value: "{GATEWAY_MODEL}"
  - name: CR_CATALOG
    value: "{CATALOG}"
  - name: CR_SCHEMA_CHURN
    value: "churn"
  - name: CR_SCHEMA_PERSONAL
    value: "{SCHEMA}"
"""
with open(os.path.join(STAGE, "app.yaml"), "w") as f:
    f.write(APP_YAML)
print("✅ Código preparado en:", STAGE)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 7 — Crear la app
# MAGIC Databricks crea la app con su propio cómputo. Esto tarda de 2 a 5 minutos la primera vez.
# MAGIC Si la app ya existe, la reutilizamos (y la encendemos si estaba detenida).

# COMMAND ----------

APP_DESC = "Central de Retención — From Zero to Hero (churn): Cockpit + Asistente + Retención."
try:
    api("GET", f"/api/2.0/apps/{APP_NAME}")
    print(f"App '{APP_NAME}' ya existe: la reutilizamos.")
except Exception as _e:
    if not _es_404(_e):
        raise RuntimeError(f"No pude consultar la app (no es un 'no existe'): {_e}") from _e
    api("POST", "/api/2.0/apps", body={
        "name": APP_NAME,
        "description": APP_DESC,
    })
    print(f"App '{APP_NAME}' creada.")

app = api("GET", f"/api/2.0/apps/{APP_NAME}")
if (app.get("compute_status") or {}).get("state") in ("STOPPED", "ERROR"):
    print("La app estaba detenida: la encendemos…")
    api("POST", f"/api/2.0/apps/{APP_NAME}/start")

for _ in range(60):
    app = api("GET", f"/api/2.0/apps/{APP_NAME}")
    if (app.get("compute_status") or {}).get("state") == "ACTIVE":
        break
    time.sleep(10)

APP_URL = app.get("url")
print("Estado del cómputo:", (app.get("compute_status") or {}).get("state"))
assert (app.get("compute_status") or {}).get("state") == "ACTIVE", \
    "El cómputo de la app todavía no está listo. Espera un minuto y vuelve a ejecutar esta celda."

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 8 — Autorizar a la app a actuar en tu nombre
# MAGIC Configuramos los **permisos de usuario** (scopes) que la app va a pedirte al abrirla, y
# MAGIC declaramos el SQL Warehouse que usa. **No se otorga ningún permiso a la app**: todo corre como tú.

# COMMAND ----------

api("PATCH", f"/api/2.0/apps/{APP_NAME}", body={
    "name": APP_NAME,
    "description": APP_DESC,
    "user_api_scopes": USER_API_SCOPES,
    "resources": [
        {"name": "sql-warehouse", "description": "Warehouse para leer Unity Catalog (como el usuario)",
         "sql_warehouse": {"id": WH_ID, "permission": "CAN_USE"}},
    ],
})
_app = api("GET", f"/api/2.0/apps/{APP_NAME}")
print("✅ Permisos de usuario:", _app.get("effective_user_api_scopes") or _app.get("user_api_scopes"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 9 — Publicar (deploy)
# MAGIC Subimos el código a la app y esperamos a que termine (1 a 3 minutos). La app es **Node.js**:
# MAGIC Databricks instala sus dependencias (`npm install`) y la inicia con el comando del `app.yaml`.

# COMMAND ----------

_dep = api("POST", f"/api/2.0/apps/{APP_NAME}/deployments",
           body={"source_code_path": STAGE, "mode": "SNAPSHOT"})
DEPLOY_ID = _dep.get("deployment_id")
estado = None
for _ in range(60):
    d = api("GET", f"/api/2.0/apps/{APP_NAME}/deployments/{DEPLOY_ID}")
    estado = (d.get("status") or {}).get("state")
    if estado in ("SUCCEEDED", "FAILED", "CANCELLED"):
        break
    time.sleep(10)
print("Deploy:", estado)
if estado != "SUCCEEDED":
    print("Detalle:", (d.get("status") or {}).get("message"))
    raise RuntimeError("El deploy no terminó bien. Vuelve a ejecutar esta celda; si sigue fallando, avisa a tu instructor.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## ¡Listo! 🎉
# MAGIC Haz clic en el enlace de abajo. La primera vez, Databricks te pide **autorizar** la app: haz clic en **Authorize**.

# COMMAND ----------

print("=" * 66)
print("  CENTRAL DE RETENCIÓN — publicada")
print("=" * 66)
print("  URL        :", APP_URL)
print("  Asistente  : Genies", GENIE_FACT, "(Facturación) y", GENIE_SOP, "(Soporte)")
print("  IA         :", GATEWAY_MODEL, "(Unity Gateway)")
print("  Identidad  : la app actúa como TÚ (on-behalf-of); no se otorgó ningún permiso extra.")
print("=" * 66)
displayHTML(f'<h3>Central de Retención</h3><p><a href="{APP_URL}" target="_blank" '
            f'style="font-size:18px">Abrir mi app →</a></p>')
