// Configuración central de la Central de Retención.
//
// AUTENTICACIÓN ON-BEHALF-OF (OBO): dentro del Databricks App, TODAS las llamadas de datos e IA se
// ejecutan con la identidad del USUARIO LOGUEADO. Databricks Apps inyecta su token OAuth en el
// encabezado `x-forwarded-access-token` (habilitado por los scopes del app: sql, genie, ai-gateway y
// model-serving). Así el app no necesita ningún permiso propio: usa los permisos de quien lo abre.

const env = (k, d = "") => (process.env[k] ?? d).trim();

export const IS_DATABRICKS_APP = Boolean(process.env.DATABRICKS_APP_NAME);
export const PORT = Number(process.env.DATABRICKS_APP_PORT || process.env.PORT || 8000);

export const WAREHOUSE_ID = env("CR_WAREHOUSE_ID");
export const CATALOG = env("CR_CATALOG", "fromzerotohero");
export const SCHEMA_CHURN = env("CR_SCHEMA_CHURN", "churn");
export const SCHEMA_PERSONAL = env("CR_SCHEMA_PERSONAL", "tu_schema");
export const GENIE_FACTURACION = env("CR_GENIE_FACTURACION");
export const GENIE_SOPORTE = env("CR_GENIE_SOPORTE");
export const EXPLAIN_MODEL = env("CR_EXPLAIN_MODEL", "databricks-claude-sonnet-4-5");
export const GATEWAY_MODEL = env("CR_GATEWAY_MODEL");

export const CH = `${CATALOG}.${SCHEMA_CHURN}`;
export const PE = `${CATALOG}.${SCHEMA_PERSONAL}`;

/** Host del workspace con https:// (dentro del App, DATABRICKS_HOST viene sin esquema). */
export function workspaceHost() {
  const h = env("DATABRICKS_HOST");
  if (!h) return "";
  return h.startsWith("http") ? h.replace(/\/$/, "") : `https://${h}`;
}

/** Token del usuario (OBO). Fuera del App (desarrollo local) se puede usar DATABRICKS_TOKEN. */
export function userToken(req) {
  const t = req.get("x-forwarded-access-token");
  if (t) return t;
  return IS_DATABRICKS_APP ? null : env("DATABRICKS_TOKEN") || null;
}

export function summary() {
  return {
    modo: IS_DATABRICKS_APP ? "databricks_app" : "local",
    auth: "on-behalf-of-user (x-forwarded-access-token)",
    host: workspaceHost(),
    warehouse_id: WAREHOUSE_ID,
    catalog: CATALOG,
    schema_churn: SCHEMA_CHURN,
    schema_personal: SCHEMA_PERSONAL,
    genie_facturacion: GENIE_FACTURACION || null,
    genie_soporte: GENIE_SOPORTE || null,
    gateway_model: GATEWAY_MODEL || null,
    node: process.version,
  };
}
