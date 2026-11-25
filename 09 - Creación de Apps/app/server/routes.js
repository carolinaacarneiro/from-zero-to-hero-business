// Rutas /api de las tres pestañas: Cockpit, Asistente y Retención.
import { Router } from "express";
import { CH, PE, userToken } from "./config.js";
import { query, num } from "./warehouse.js";
import { explicarGrafico, redactarEmail } from "./llm.js";
import { ESPECIALISTAS, clasificar, preguntarGenie } from "./genie.js";

export const router = Router();

// ------------------------------------------------------------------ Cockpit
const REGIONES = ["Centroamérica", "Andina", "Caribe", "México", "Cono Sur"];
const PLANES = ["Básico", "Estándar", "Premium", "Empresarial"];
const SEGS = ["Consumidor", "PyME", "Corporativo"];
const MES_KEYS = ["2024-09", "2024-10", "2024-11", "2024-12", "2025-01", "2025-02",
  "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08"];

// Región a partir del código de país (`pais`, ISO de 2 letras).
const REG = `CASE WHEN c.pais IN ('MX') THEN 'México'
  WHEN c.pais IN ('CO','PE','EC','VE','BO') THEN 'Andina'
  WHEN c.pais IN ('AR','CL','UY','PY') THEN 'Cono Sur'
  WHEN c.pais IN ('DO','CU','PR') THEN 'Caribe'
  WHEN c.pais IN ('CR','PA','GT','HN','SV','NI') THEN 'Centroamérica' END`;

const vacio = () => ({
  clientes: 0, riesgo: 0, plan: PLANES.map(() => 0), seg: SEGS.map(() => 0),
  nivel: { Alto: 0, Medio: 0, Bajo: 0 }, meses: MES_KEYS.map(() => 0),
});

router.get("/cockpit/datos", async (req, res) => {
  const token = userToken(req);
  const [rNivel, rPlan, rSeg, rMeses, rKpi, rAuc] = await Promise.all([
    query(`SELECT ${REG} region, s.nivel_riesgo nivel, count(*) n
           FROM ${PE}.churn_scores s JOIN ${CH}.dim_cliente c USING(id_cliente) GROUP BY 1,2`, token),
    query(`SELECT ${REG} region, p.nombre_plan clave, sum(f.churn_flag) churn_n, count(*) total
           FROM ${CH}.hecho_suscripcion f JOIN ${CH}.dim_cliente c USING(id_cliente)
           JOIN ${CH}.dim_plan p USING(id_plan) GROUP BY 1,2`, token),
    query(`SELECT ${REG} region, c.segmento clave, sum(f.churn_flag) churn_n, count(*) total
           FROM ${CH}.hecho_suscripcion f JOIN ${CH}.dim_cliente c USING(id_cliente) GROUP BY 1,2`, token),
    query(`SELECT ${REG} region, date_format(f.fecha_fin,'yyyy-MM') mes, count(*) n
           FROM ${CH}.hecho_suscripcion f JOIN ${CH}.dim_cliente c USING(id_cliente)
           WHERE f.fecha_fin >= '2024-09-01' GROUP BY 1,2`, token),
    query(`SELECT (SELECT round(sum(precio_mensual),2) FROM ${PE}.churn_scores WHERE nivel_riesgo='Alto') mrr_riesgo,
                  (SELECT round(100*avg(churn_flag),0) FROM ${CH}.hecho_suscripcion) churn_pct,
                  (SELECT round(avg(prob_churn),2) FROM ${PE}.churn_scores WHERE nivel_riesgo='Alto') prob_alto`, token),
    // El notebook del Ej. 06 guarda el AUC como propiedad de la tabla churn_scores.
    query(`SHOW TBLPROPERTIES ${PE}.churn_scores ('auc')`, token),
  ]);

  const D = Object.fromEntries([...REGIONES, "LATAM"].map((r) => [r, vacio()]));

  for (const row of rNivel) {
    const n = num(row.n);
    if (D[row.region] && row.nivel in D[row.region].nivel) {
      D[row.region].nivel[row.nivel] += n;
      D.LATAM.nivel[row.nivel] += n;
    }
  }
  for (const r of Object.keys(D)) {
    const f = D[r].nivel;
    D[r].clientes = f.Alto + f.Medio + f.Bajo;
    D[r].riesgo = f.Alto;
  }

  // Porcentajes recompuestos a partir de los CONTEOS (LATAM = suma churn / suma total, no promedio de promedios).
  const pcts = (rows, orden, destino) => {
    const acc = {};
    for (const row of rows) {
      if (!D[row.region] || !orden.includes(row.clave)) continue;
      for (const r of [row.region, "LATAM"]) {
        acc[r] ??= Object.fromEntries(orden.map((k) => [k, [0, 0]]));
        acc[r][row.clave][0] += num(row.churn_n);
        acc[r][row.clave][1] += num(row.total);
      }
    }
    for (const r of Object.keys(D)) {
      D[r][destino] = orden.map((k) => {
        const [c, t] = acc[r]?.[k] || [0, 0];
        return t ? Math.round((1000 * c) / t) / 10 : 0;
      });
    }
  };
  pcts(rPlan, PLANES, "plan");
  pcts(rSeg, SEGS, "seg");

  for (const row of rMeses) {
    const i = MES_KEYS.indexOf(row.mes);
    if (D[row.region] && i >= 0) {
      D[row.region].meses[i] += num(row.n);
      D.LATAM.meses[i] += num(row.n);
    }
  }

  const kpi = rKpi[0] || {};
  const auc = Number(rAuc[0]?.value);
  res.json({
    D,
    kpi: {
      // Sin dato devolvemos null: la pantalla muestra "—", nunca un número inventado.
      churn_pct: kpi.churn_pct == null ? null : Math.round(num(kpi.churn_pct)),
      riesgo_alto: D.LATAM.riesgo,
      mrr_riesgo: num(kpi.mrr_riesgo),
      prob_alto: kpi.prob_alto == null ? null : num(kpi.prob_alto),
      auc: Number.isFinite(auc) ? auc.toFixed(2) : null,
    },
  });
});

router.post("/cockpit/explicar", async (req, res) => {
  const { grafico, region, datos } = req.body || {};
  res.json({ texto: await explicarGrafico(grafico, region, datos, userToken(req)) });
});

// ------------------------------------------------------------------ Asistente
router.post("/asistente/preguntar", async (req, res) => {
  const pregunta = String(req.body?.pregunta || "").trim();
  if (!pregunta) return res.json({ ok: false, respuesta: "Escribe una pregunta." });
  const token = userToken(req);
  const [especialista, metodo] = await clasificar(pregunta, token);
  const r = await preguntarGenie(especialista, pregunta, token);
  const nombre = ESPECIALISTAS[especialista];
  if (!r.ok) return res.json({ ok: false, especialista: nombre, metodo, respuesta: `${r.error} Inténtalo de nuevo en unos segundos.` });
  res.json({ ok: true, especialista: nombre, metodo, respuesta: r.respuesta, tabla: r.tabla, sql: r.sql });
});

// ------------------------------------------------------------------ Retención
router.get("/retencion/lista", async (req, res) => {
  const rows = await query(`
    SELECT s.id_cliente, c.nombre_cliente, c.ciudad, c.pais,
           floor(datediff(DATE '2026-09-23', c.fecha_registro)/365) anios,
           s.nombre_plan, round(s.prob_churn,3) prob, s.factor_principal
    FROM ${PE}.churn_scores s JOIN ${CH}.dim_cliente c USING(id_cliente)
    WHERE s.nivel_riesgo='Alto' ORDER BY s.prob_churn DESC LIMIT 12`, userToken(req));
  res.json({
    clientes: rows.map((r) => ({
      id: r.id_cliente, nombre: r.nombre_cliente, ciudad: r.ciudad, pais: r.pais,
      anios: Math.trunc(num(r.anios)), plan: r.nombre_plan, prob: Math.round(num(r.prob) * 100),
      factor: r.factor_principal,
    })),
  });
});

// Solo letras y dígitos: evita inyección en el literal de la UC function.
const sanitizarId = (raw) => String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);

router.post("/retencion/email", async (req, res) => {
  const cid = sanitizarId(req.body?.id_cliente);
  if (!cid) return res.json({ ok: false, error: "ID inválido." });
  const token = userToken(req);
  const rows = await query(`SELECT * FROM ${PE}.get_cliente_360('${cid}')`, token);
  if (!rows.length) return res.json({ ok: false, error: "ID no encontrado en la base de riesgo." });
  const perfil = rows[0];
  const email = await redactarEmail(perfil, token);
  if (!email) return res.json({ ok: false, error: "No fue posible generar el e-mail en este momento. Inténtalo de nuevo." });
  res.json({
    ok: true, id_cliente: cid, email,
    perfil: {
      nombre: perfil.nombre_cliente, ciudad: perfil.ciudad, plan: perfil.nombre_plan,
      anios: num(perfil.anios_como_cliente), prob: Math.round(num(perfil.prob_churn) * 100),
      factor: perfil.factor_principal,
    },
    ofertas: { descuento: perfil.descuento, internet: perfil.oferta_internet, factor: perfil.oferta_factor },
  });
});
