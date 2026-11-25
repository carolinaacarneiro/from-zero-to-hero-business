// Capa de IA de la app, llamada con el TOKEN DEL USUARIO (on-behalf-of).
//   - Con CR_GATEWAY_MODEL (lo normal): el model service del Unity Gateway en
//     /ai-gateway/mlflow/v1/chat/completions (API compatible con OpenAI; el model service va en `model`).
//   - Sin él (respaldo): el foundation model CR_EXPLAIN_MODEL en /serving-endpoints/<modelo>/invocations.
import { EXPLAIN_MODEL, GATEWAY_MODEL, workspaceHost } from "./config.js";

function textoDe(contenido) {
  if (typeof contenido === "string") return contenido;
  if (Array.isArray(contenido)) {
    return contenido
      .filter((b) => b && typeof b === "object" && (b.type === undefined || b.type === "text"))
      .map((b) => b.text || "")
      .join("");
  }
  return contenido ? String(contenido) : "";
}

export async function chat(system, user, token, { maxTokens = 400, timeoutMs = 45000 } = {}) {
  if (!token) return null;
  const host = workspaceHost();
  const body = {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
  };
  let url;
  if (GATEWAY_MODEL) {
    url = `${host}/ai-gateway/mlflow/v1/chat/completions`;
    body.model = GATEWAY_MODEL;
  } else {
    url = `${host}/serving-endpoints/${EXPLAIN_MODEL}/invocations`;
  }
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const txt = await r.text();
    if (!r.ok) {
      console.log(`[chat] HTTP ${r.status}: ${txt.slice(0, 300)}`);
      return null;
    }
    const d = JSON.parse(txt);
    return textoDe(d?.choices?.[0]?.message?.content).trim() || null;
  } catch (e) {
    console.log(`[chat] no disponible: ${e?.message || e}`);
    return null;
  }
}

const CONTEXTO = {
  plan: "Churn (%) por plan de suscripción",
  nivel: "Distribución de clientes por nivel de riesgo de churn (Alto/Medio/Bajo)",
  meses: "Cancelaciones de suscripción por mes (sep/24 a ago/25)",
  seg: "Churn (%) por segmento de cliente (Consumidor/PyME/Corporativo)",
};

export async function explicarGrafico(grafico, region, datos, token) {
  const donde = region === "LATAM" ? "en LATAM (todas las regiones)" : `en la región ${region}`;
  const system =
    "Eres un analista de retención (Customer Success) de una empresa de suscripción. Explicas gráficos " +
    "de churn a un gerente, en español latinoamericano, de forma directa y accionable. Responde en COMO " +
    "MÁXIMO 2 frases cortas. No uses markdown, listas ni emojis. Cita los números más relevantes y una " +
    "recomendación práctica.";
  const user = `Gráfico: ${CONTEXTO[grafico] || grafico}, ${donde}.\nDatos (JSON): ${JSON.stringify(datos)}\nEscribe la lectura del gráfico.`;
  // Margen de tokens: los modelos de razonamiento (ej.: gpt-oss) gastan parte del límite pensando.
  const r = await chat(system, user, token, { maxTokens: 600 });
  return r || "No fue posible generar la lectura de la IA en este momento. Inténtalo de nuevo.";
}

export async function redactarEmail(perfil, token) {
  const system =
    "Eres un especialista en retención de clientes de una empresa de suscripción. Redacta un e-mail " +
    "profesional y empático en español latinoamericano para convencer al cliente de permanecer. Ofrece " +
    "EXACTAMENTE las ofertas indicadas, sin inventar otras y sin cambiar valores. No menciones el sector " +
    "de la empresa. Comienza con el saludo (no incluyas línea de asunto) y escribe en texto simple, sin " +
    "markdown, sin asteriscos, sin listas y sin emojis.";
  const user =
    `Datos: Nombre: ${perfil.nombre_cliente}, Ciudad: ${perfil.ciudad}, Años como cliente: ${perfil.anios_como_cliente}. ` +
    `Ofertas: (a) descuento de ${perfil.descuento} en la mensualidad; (b) ${perfil.oferta_internet}; (c) ${perfil.oferta_factor}. ` +
    "Menciona el nombre, la ciudad y los años como cliente, e incluye las tres ofertas de forma natural.";
  return chat(system, user, token, { maxTokens: 1500, timeoutMs: 120000 });
}
