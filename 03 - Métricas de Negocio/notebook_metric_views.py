# Databricks notebook source
# MAGIC %md
# MAGIC # Ejercicio 3 — Metric Views (métricas gobernadas)
# MAGIC
# MAGIC Este notebook crea **tres metric views** en **tu schema personal**, leyendo de la base compartida
# MAGIC `fromzerotohero.churn`, y después las consulta con `MEASURE()`.
# MAGIC
# MAGIC | Metric view | Medidas | Dimensiones (por dónde cortar) |
# MAGIC |---|---|---|
# MAGIC | `mvw_churn` | Cancelaciones, Clientes, Tasa de Churn | Segmento, Plan, Mes |
# MAGIC | `mvw_ingresos` | Ingresos, Morosidad, Ticket Promedio | Segmento, Mes |
# MAGIC | `mvw_soporte` | Tickets, CSAT Promedio, NPS Promedio | Segmento, Canal, Categoría |
# MAGIC
# MAGIC ### ¿Qué es una Metric View?
# MAGIC Una **view especial** de Unity Catalog que guarda la **definición oficial** de cada métrica.
# MAGIC Separa las **dimensiones** (por dónde cortar: segmento, plan, mes) de las **medidas** (qué
# MAGIC calcular: tasa de churn, ingresos). Se escribe una vez, en **YAML** (un formato de texto
# MAGIC ordenado), y todos la reutilizan: SQL, dashboards y Genie Agents usan la misma fórmula.
# MAGIC
# MAGIC ### ▶️ Cómo ejecutarlo
# MAGIC 1. Arriba a la derecha, haz clic en **Connect** y elige `fromzerotohero_workshop_cluster`.
# MAGIC 2. Ejecuta la celda de abajo (**Shift + Enter**): aparece el campo **Tu schema** (arriba del notebook o en el panel lateral **Parameters**).
# MAGIC 3. Escribe tu schema (ej.: `ggarcia`) y haz clic en **Run all**.

# COMMAND ----------

dbutils.widgets.text("schema", "", "Tu schema")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Crear las metric views
# MAGIC Cada celda de abajo crea una metric view. Lee la primera con calma:
# MAGIC - `source`: la tabla principal (los hechos).
# MAGIC - `joins`: las tablas que se unen para traer más información (por ejemplo, el segmento del cliente).
# MAGIC - `dimensions`: las columnas por las que vas a cortar los números.
# MAGIC - `measures`: las fórmulas de las métricas.

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE SCHEMA IF NOT EXISTS IDENTIFIER('fromzerotohero.' || :schema)

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE VIEW IDENTIFIER('fromzerotohero.' || :schema || '.mvw_churn') (
# MAGIC   `Segmento`      COMMENT 'Segmento del cliente',
# MAGIC   `Plan`          COMMENT 'Nombre del plan',
# MAGIC   `Mes`           COMMENT 'Mes de la cancelación',
# MAGIC   `Cancelaciones` COMMENT 'Suscripciones canceladas',
# MAGIC   `Clientes`      COMMENT 'Total de clientes',
# MAGIC   `Tasa de Churn` COMMENT 'Cancelaciones / Clientes'
# MAGIC ) WITH METRICS LANGUAGE YAML
# MAGIC COMMENT 'Métricas de churn/retención' AS $$
# MAGIC version: 0.1
# MAGIC source: fromzerotohero.churn.hecho_suscripcion
# MAGIC joins:
# MAGIC   - name: cliente
# MAGIC     source: fromzerotohero.churn.dim_cliente
# MAGIC     'on': source.id_cliente = cliente.id_cliente
# MAGIC   - name: plan
# MAGIC     source: fromzerotohero.churn.dim_plan
# MAGIC     'on': source.id_plan = plan.id_plan
# MAGIC dimensions:
# MAGIC   - name: Segmento
# MAGIC     expr: cliente.segmento
# MAGIC   - name: Plan
# MAGIC     expr: plan.nombre_plan
# MAGIC   - name: Mes
# MAGIC     expr: date_trunc('MONTH', source.fecha_fin)
# MAGIC measures:
# MAGIC   - name: Cancelaciones
# MAGIC     expr: SUM(source.churn_flag)
# MAGIC   - name: Clientes
# MAGIC     expr: COUNT(DISTINCT source.id_cliente)
# MAGIC   - name: Tasa de Churn
# MAGIC     expr: COUNT(source.churn_flag) / COUNT(DISTINCT source.id_cliente)
# MAGIC $$

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE VIEW IDENTIFIER('fromzerotohero.' || :schema || '.mvw_ingresos') (
# MAGIC   `Segmento`       COMMENT 'Segmento del cliente',
# MAGIC   `Mes`            COMMENT 'Periodo (mes)',
# MAGIC   `Ingresos`       COMMENT 'Suma facturada',
# MAGIC   `Morosidad`      COMMENT 'Porcentaje de facturas no pagadas',
# MAGIC   `Ticket Promedio` COMMENT 'Valor promedio por factura'
# MAGIC ) WITH METRICS LANGUAGE YAML
# MAGIC COMMENT 'Métricas de ingresos' AS $$
# MAGIC version: 0.1
# MAGIC source: fromzerotohero.churn.hecho_facturacion
# MAGIC joins:
# MAGIC   - name: cliente
# MAGIC     source: fromzerotohero.churn.dim_cliente
# MAGIC     'on': source.id_cliente = cliente.id_cliente
# MAGIC dimensions:
# MAGIC   - name: Segmento
# MAGIC     expr: cliente.segmento
# MAGIC   - name: Mes
# MAGIC     expr: date_trunc('MONTH', source.periodo)
# MAGIC measures:
# MAGIC   - name: Ingresos
# MAGIC     expr: SUM(source.monto)
# MAGIC   - name: Morosidad
# MAGIC     expr: AVG(CASE WHEN NOT source.pago THEN 1.0 ELSE 0.0 END)
# MAGIC   - name: Ticket Promedio
# MAGIC     expr: AVG(source.monto)
# MAGIC $$

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE VIEW IDENTIFIER('fromzerotohero.' || :schema || '.mvw_soporte') (
# MAGIC   `Segmento`      COMMENT 'Segmento del cliente',
# MAGIC   `Canal`         COMMENT 'Canal del ticket',
# MAGIC   `Categoría`     COMMENT 'Categoría del ticket',
# MAGIC   `Tickets`       COMMENT 'Cantidad de tickets',
# MAGIC   `CSAT Promedio` COMMENT 'CSAT promedio (1-5)',
# MAGIC   `NPS Promedio`  COMMENT 'NPS promedio (0-10)'
# MAGIC ) WITH METRICS LANGUAGE YAML
# MAGIC COMMENT 'Métricas de atención' AS $$
# MAGIC version: 0.1
# MAGIC source: fromzerotohero.churn.hecho_ticket_soporte
# MAGIC joins:
# MAGIC   - name: cliente
# MAGIC     source: fromzerotohero.churn.dim_cliente
# MAGIC     'on': source.id_cliente = cliente.id_cliente
# MAGIC dimensions:
# MAGIC   - name: Segmento
# MAGIC     expr: cliente.segmento
# MAGIC   - name: Canal
# MAGIC     expr: source.canal
# MAGIC   - name: Categoría
# MAGIC     expr: source.categoria
# MAGIC measures:
# MAGIC   - name: Tickets
# MAGIC     expr: COUNT(1)
# MAGIC   - name: CSAT Promedio
# MAGIC     expr: AVG(source.csat)
# MAGIC   - name: NPS Promedio
# MAGIC     expr: AVG(source.nps)
# MAGIC $$

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Consultar con MEASURE()
# MAGIC Para usar una medida, la pides por su **nombre** con `MEASURE()` y eliges las dimensiones en el
# MAGIC `GROUP BY`. No repites la fórmula: la metric view ya la sabe.

# COMMAND ----------

# MAGIC %sql
# MAGIC -- Ingresos y morosidad por segmento
# MAGIC SELECT `Segmento`,
# MAGIC        ROUND(MEASURE(`Ingresos`), 2)  AS ingresos,
# MAGIC        ROUND(MEASURE(`Morosidad`), 3) AS morosidad
# MAGIC FROM IDENTIFIER('fromzerotohero.' || :schema || '.mvw_ingresos')
# MAGIC GROUP BY `Segmento`
# MAGIC ORDER BY ingresos DESC

# COMMAND ----------

# MAGIC %sql
# MAGIC -- CSAT y NPS por categoría de ticket
# MAGIC SELECT `Categoría`,
# MAGIC        MEASURE(`Tickets`)                 AS tickets,
# MAGIC        ROUND(MEASURE(`CSAT Promedio`), 2) AS csat,
# MAGIC        ROUND(MEASURE(`NPS Promedio`), 2)  AS nps
# MAGIC FROM IDENTIFIER('fromzerotohero.' || :schema || '.mvw_soporte')
# MAGIC GROUP BY `Categoría`
# MAGIC ORDER BY tickets DESC

# COMMAND ----------

print(f"✅ Metric views creadas en fromzerotohero.{dbutils.widgets.get('schema')}: mvw_churn, mvw_ingresos, mvw_soporte")
print("   Vuelve al README del Ej. 3 para el Paso 2 (antes × después).")
