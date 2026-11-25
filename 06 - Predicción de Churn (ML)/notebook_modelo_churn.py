# Databricks notebook source
# MAGIC %md
# MAGIC # Ejercicio 6 — Modelo de predicción de churn
# MAGIC
# MAGIC Este notebook entrena un **modelo de Machine Learning** que estima la **probabilidad de que cada
# MAGIC cliente cancele**, lo registra (gobernado) en Unity Catalog y guarda una **tabla de scores** lista
# MAGIC para los dashboards, los agentes y la app.
# MAGIC
# MAGIC | | |
# MAGIC |---|---|
# MAGIC | **Fuente** | `fromzerotohero.churn.feature_churn`: una fila por cliente con su comportamiento (uso, atraso de pago, satisfacción) y si canceló (`churn_flag`) |
# MAGIC | **Crea en tu schema** | `modelo_churn` (el modelo) y `churn_scores` (el riesgo de cada cliente) |
# MAGIC | **Tiempo** | ~2 a 4 minutos con **Run all** |
# MAGIC
# MAGIC ### ¿Qué es un modelo de Machine Learning?
# MAGIC Un programa que **aprende de ejemplos del pasado**. Le mostramos 2.000 clientes con su
# MAGIC comportamiento y si cancelaron o no; el modelo encuentra los patrones (por ejemplo: *poco uso +
# MAGIC facturas atrasadas = más riesgo*) y después calcula, para cada cliente, una **probabilidad de
# MAGIC churn** entre 0 y 1.
# MAGIC
# MAGIC ### ▶️ Cómo ejecutarlo
# MAGIC 1. Arriba a la derecha, **Connect** → `fromzerotohero_workshop_cluster`.
# MAGIC 2. Ejecuta las celdas **hasta el Paso 1** (Shift + Enter en cada una): aparece el campo **Tu schema** (arriba del notebook o en el panel lateral **Parameters**).
# MAGIC 3. Escribe tu schema (ej.: `ggarcia`) y haz clic en **Run all**.

# COMMAND ----------

# MAGIC %pip install scikit-learn "mlflow>=3"

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 1 — Configura tu schema
# MAGIC Escribe tu schema personal en el campo de abajo.

# COMMAND ----------

dbutils.widgets.text("schema", "", "Tu schema")
SCHEMA = dbutils.widgets.get("schema").strip()
assert SCHEMA, "Escribe tu schema en el campo 'Tu schema' (ej.: ggarcia) y vuelve a hacer clic en Run all."
SCHEMA_FQN = f"fromzerotohero.{SCHEMA}"
MODEL  = f"{SCHEMA_FQN}.modelo_churn"
SCORES = f"{SCHEMA_FQN}.churn_scores"
print("Modelo  ->", MODEL)
print("Scores  ->", SCORES)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 2 — Entrenar el modelo
# MAGIC Lo que hace esta celda, en orden:
# MAGIC 1. **Lee** la tabla `feature_churn` (2.000 clientes).
# MAGIC 2. Separa lo que queremos **predecir** (`churn_flag`, la "respuesta") de las **pistas** que usa el modelo
# MAGIC    (uso, horas, atraso de pago, CSAT, NPS, plan, segmento).
# MAGIC 3. Divide los clientes en **entrenamiento (75%)** y **prueba (25%)**: el modelo aprende con el primer grupo
# MAGIC    y lo evaluamos con el segundo, que nunca vio. Es como estudiar con unos ejercicios y rendir el examen con otros.
# MAGIC 4. Entrena un **Gradient Boosting** (muchos árboles de decisión pequeños que se corrigen entre sí).
# MAGIC 5. Mide la calidad con el **AUC**: de 0,5 (adivinar al azar) a 1,0 (perfecto). Más de 0,9 es excelente.

# COMMAND ----------

import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

df = spark.table("fromzerotohero.churn.feature_churn").toPandas()
y = df["churn_flag"].astype(int)
X = df.drop(columns=["id_cliente", "churn_flag"])

cat = ["segmento", "nombre_plan"]
num = [c for c in X.columns if c not in cat]

pre = ColumnTransformer([
    ("cat", OneHotEncoder(handle_unknown="ignore"), cat),
    ("num", "passthrough", num),
])
pipe = Pipeline([("pre", pre), ("clf", GradientBoostingClassifier(random_state=42))])

Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
pipe.fit(Xtr, ytr)
auc = roc_auc_score(yte, pipe.predict_proba(Xte)[:, 1])
print(f"AUC (prueba): {auc:.3f}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 3 — Registrar el modelo en Unity Catalog
# MAGIC **MLflow** es la herramienta de Databricks que registra todo lo de un modelo: métricas (el AUC), versión y
# MAGIC el modelo en sí. Al registrarlo en **Unity Catalog**, el modelo pasa a ser un activo gobernado,
# MAGIC igual que una tabla: tiene dueño (tú), permisos, versiones y linaje (de qué datos salió).

# COMMAND ----------

import mlflow

class ChurnProb(mlflow.pyfunc.PythonModel):
    def __init__(self, model):
        self.model = model
    def predict(self, context, model_input):
        return self.model.predict_proba(model_input)[:, 1]

mlflow.set_registry_uri("databricks-uc")
signature = mlflow.models.infer_signature(X, pipe.predict_proba(X)[:, 1])

with mlflow.start_run(run_name="modelo_churn"):
    mlflow.log_metric("auc", auc)
    mlflow.pyfunc.log_model(
        name="model",
        python_model=ChurnProb(pipe),
        signature=signature,
        input_example=X.head(3),
        registered_model_name=MODEL,
    )
print("Modelo registrado:", MODEL)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Paso 4 — Generar la tabla de scores
# MAGIC Calculamos la probabilidad de churn de **todos** los clientes y agregamos dos columnas fáciles de leer para el negocio:
# MAGIC - **`nivel_riesgo`**: **Alto** (≥ 0,50), **Medio** (≥ 0,25) o **Bajo**.
# MAGIC - **`factor_principal`**: la señal que más se destaca en cada cliente: *Bajo uso*, *Morosidad*,
# MAGIC   *Insatisfacción (CSAT)* o *Detractor (NPS)*. Es la "explicación de negocio" que verás en la app.
# MAGIC
# MAGIC > Nota: calculamos el score de todos los clientes, incluidos los que el modelo usó para aprender. Para un
# MAGIC > ejercicio está bien; en producción se calcula sobre clientes nuevos o actuales.

# COMMAND ----------

scores = df[["id_cliente", "segmento", "nombre_plan", "precio_mensual"]].copy()
scores["prob_churn"] = pipe.predict_proba(X)[:, 1]

# nivel de riesgo (umbrales fijos, interpretables)
def nivel(p):
    return "Alto" if p >= 0.50 else ("Medio" if p >= 0.25 else "Bajo")
scores["nivel_riesgo"] = scores["prob_churn"].apply(nivel)

# señal principal: el factor de riesgo que más se destaca (z-score orientado al riesgo)
z = (X[num] - X[num].mean()) / X[num].std(ddof=0)
senales = pd.DataFrame({
    "Bajo uso":              -z["uso_promedio"],
    "Morosidad":              z["pct_facturas_atraso"],
    "Insatisfacción (CSAT)": -z["csat_promedio"],
    "Detractor (NPS)":       -z["nps_promedio"],
})
scores["factor_principal"] = senales.idxmax(axis=1)
scores["prob_churn"] = scores["prob_churn"].astype(float).round(4)

spark.createDataFrame(scores).write.mode("overwrite").saveAsTable(SCORES)
# Guardamos el AUC como propiedad de la tabla: la app del Ej. 9 lo muestra en el Cockpit.
spark.sql(f"ALTER TABLE {SCORES} SET TBLPROPERTIES ('auc' = '{auc:.4f}')")
print("Tabla de scores guardada:", SCORES)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Revisa el resultado
# MAGIC Compara con lo esperado en el README: **AUC ≈ 0,97** y la distribución de riesgo de abajo.

# COMMAND ----------

print(f"AUC (prueba): {auc:.3f}")

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT
# MAGIC     nivel_riesgo,
# MAGIC     COUNT(*) AS clientes,
# MAGIC     ROUND(AVG(prob_churn), 3) AS prob_promedio
# MAGIC FROM IDENTIFIER('fromzerotohero.' || :schema || '.churn_scores')
# MAGIC GROUP BY nivel_riesgo
# MAGIC ORDER BY prob_promedio DESC


# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT
# MAGIC     *
# MAGIC FROM IDENTIFIER('fromzerotohero.' || :schema || '.churn_scores')
# MAGIC ORDER BY prob_churn DESC
# MAGIC LIMIT 10
