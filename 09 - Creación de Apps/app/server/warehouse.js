// Lectura de Unity Catalog con la identidad del USUARIO (OBO), mediante el SQL Warehouse.
// Usa el conector oficial @databricks/sql. Degradación controlada: error o token ausente -> [].
import { DBSQLClient } from "@databricks/sql";
import { WAREHOUSE_ID, workspaceHost } from "./config.js";

export async function query(sql, token) {
  if (!token) {
    console.log("[warehouse] sin token de usuario; devolviendo vacío");
    return [];
  }
  const client = new DBSQLClient();
  try {
    await client.connect({
      host: workspaceHost().replace(/^https?:\/\//, ""),
      path: `/sql/1.0/warehouses/${WAREHOUSE_ID}`,
      token,
    });
    const session = await client.openSession();
    try {
      const op = await session.executeStatement(sql, { runAsync: true });
      const rows = await op.fetchAll();
      await op.close();
      return rows;
    } finally {
      await session.close();
    }
  } catch (e) {
    console.log(`[warehouse] error: ${String(e?.message || e).slice(0, 300)}`);
    return [];
  } finally {
    await client.close().catch(() => {});
  }
}

/** Convierte un valor a número de forma segura (el conector puede devolver string/Decimal/null). */
export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
