// Asistente multi-agente: un ROUTER elige al especialista y la Genie Agents API responde.
//   1. clasificar(): el model service del Unity Gateway lee la pregunta y responde FACTURACION o
//      SOPORTE. Si la IA no está disponible, se usa un respaldo por palabras clave.
//   2. preguntarGenie(): envía la pregunta al Genie Agent elegido (Ej. 07) con la Conversation API
//      y espera la respuesta final (texto + SQL + resultado en columnas y filas).
// Todo con el token del usuario (scope `genie`). Referencia: https://docs.databricks.com/api/genie/v1/conversation
import { GENIE_FACTURACION, GENIE_SOPORTE, workspaceHost } from "./config.js";
import { chat } from "./llm.js";

export const ESPECIALISTAS = { facturacion: "Facturación", soporte: "Soporte" };

const SOPORTE = ["ticket", "soporte", "atencion", "csat", "nps", "satisfaccion", "canal", "reclamo",
  "chat", "telefono", "categoria", "queja", "detractor"];
const FACTURACION = ["factura", "ingreso", "monto", "pago", "pagad", "moros", "cobr", "deuda", "plan",
  "precio", "atraso", "mrr"];
const FINALES = new Set(["COMPLETED", "FAILED", "CANCELLED", "QUERY_RESULT_EXPIRED"]);

const normalizar = (t) => (t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

function porPalabras(pregunta) {
  const t = normalizar(pregunta);
  const s = SOPORTE.filter((p) => t.includes(p)).length;
  const f = FACTURACION.filter((p) => t.includes(p)).length;
  return s > f ? "soporte" : "facturacion";
}

export async function clasificar(pregunta, token) {
  const system =
    "Eres un router. Tienes dos especialistas: FACTURACION (ingresos, facturas, pagos, morosidad, montos, " +
    "planes y precios) y SOPORTE (tickets de atención, CSAT, NPS, canales, categorías y reclamos). Lee la " +
    "pregunta y responde SOLO con una palabra: FACTURACION o SOPORTE.";
  const r = normalizar(await chat(system, pregunta, token, { maxTokens: 400, timeoutMs: 30000 }));
  if (r.includes("soporte") && !r.includes("facturacion")) return ["soporte", "ia"];
  if (r.includes("facturacion") && !r.includes("soporte")) return ["facturacion", "ia"];
  return [porPalabras(pregunta), "palabras clave"];
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function preguntarGenie(especialista, pregunta, token) {
  const space = especialista === "soporte" ? GENIE_SOPORTE : GENIE_FACTURACION;
  if (!token) return { ok: false, error: "Falta el token del usuario (on-behalf-of)." };
  if (!space) return { ok: false, error: `No hay un Genie de ${ESPECIALISTAS[especialista]} configurado en la app.` };

  const base = `${workspaceHost()}/api/2.0/genie/spaces/${space}`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const get = (url) => fetch(url, { headers, signal: AbortSignal.timeout(30000) });

  try {
    const r0 = await fetch(`${base}/start-conversation`, {
      method: "POST", headers, body: JSON.stringify({ content: pregunta }), signal: AbortSignal.timeout(60000),
    });
    if (!r0.ok) {
      console.log(`[genie] start-conversation HTTP ${r0.status}: ${(await r0.text()).slice(0, 300)}`);
      return { ok: false, error: `El Genie respondió HTTP ${r0.status}.` };
    }
    const inicio = await r0.json();
    const conv = inicio.conversation_id || inicio.conversation?.id;
    const msgId = inicio.message_id || inicio.message?.id;
    if (!conv || !msgId) return { ok: false, error: "Respuesta inesperada del Genie." };

    // Sondeo con espera creciente (1 s -> 5 s), como recomienda la documentación.
    const urlMsg = `${base}/conversations/${conv}/messages/${msgId}`;
    let msg = {};
    for (let t = 0, w = 1000; t < 120000; t += w, w = Math.min(w * 1.5, 5000)) {
      const r = await get(urlMsg);
      if (!r.ok) {
        console.log(`[genie] message HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
        return { ok: false, error: `El Genie respondió HTTP ${r.status} al consultar el estado.` };
      }
      msg = await r.json();
      if (FINALES.has(msg.status)) break;
      await espera(w);
    }
    if (msg.status !== "COMPLETED") {
      return { ok: false, error: `El Genie no completó la respuesta (estado: ${msg.status || "tiempo agotado"}).` };
    }

    const textos = [];
    let sql = null;
    let tabla = null;
    for (const att of msg.attachments || []) {
      if (att.text?.content) textos.push(att.text.content.trim());
      if (att.query) {
        sql = att.query.query || null;
        if (att.query.description) textos.push(att.query.description.trim());
        const r = await get(`${urlMsg}/attachments/${att.attachment_id}/query-result`);
        if (r.ok) {
          const st = (await r.json()).statement_response || {};
          const columnas = (st.manifest?.schema?.columns || []).map((c) => c.name);
          const filas = (st.result?.data_array || []).slice(0, 12);
          if (columnas.length) tabla = { columnas, filas, total: st.result?.data_array?.length || 0 };
        }
      }
    }
    const respuesta = textos.filter(Boolean).join("\n\n").replace(/\*\*(.+?)\*\*/g, "$1")
      || "El Genie ejecutó la consulta; mira el resultado abajo.";
    return { ok: true, respuesta, tabla, sql };
  } catch (e) {
    console.log(`[genie] no disponible: ${e?.message || e}`);
    return { ok: false, error: "No fue posible hablar con el Genie en este momento." };
  }
}
