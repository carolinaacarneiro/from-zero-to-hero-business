// Central de Retención — servidor Node.js (Express).
// Sirve la API (/api/*) y el build de React (frontend/dist). Tres pestañas: Cockpit (mapa + gráficos),
// Asistente (router + Genie Agents del Ej. 07) y Retención (UC function del Ej. 08 + Unity Gateway).
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PORT, summary, userToken } from "./config.js";
import { query } from "./warehouse.js";
import { router } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "frontend", "dist");

const app = express();
app.use(express.json({ limit: "1mb" }));

// Salud + diagnóstico OBO: confirma con QUIÉN se ejecutan las consultas (debe ser el usuario logueado).
app.get("/api/health", async (req, res) => {
  const token = userToken(req);
  const rows = await query("SELECT current_user() AS u", token);
  res.json({
    app: "central-retencion",
    ambiente: summary(),
    obo: { encabezado_usuario_presente: Boolean(req.get("x-forwarded-access-token")), corre_como: rows[0]?.u || null },
  });
});

app.use("/api", router);
app.use("/api", (_req, res) => res.status(404).json({ error: "ruta no encontrada" }));

if (existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: "1h" }));
  app.get("*", (_req, res) => res.sendFile(path.join(DIST, "index.html")));
} else {
  app.get("/", (_req, res) => res.json({ aviso: "frontend/dist no construido. Ejecuta `npm run build` en frontend/." }));
}

app.listen(PORT, "0.0.0.0", () => console.log(`[central-retencion] escuchando en :${PORT} (Node ${process.version})`));
