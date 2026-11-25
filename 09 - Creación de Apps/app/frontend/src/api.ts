// Cliente HTTP liviano. En dev, Vite hace proxy de /api -> :8000; en producción el propio servidor
// Node sirve SPA + API, así que las rutas relativas funcionan.

export type RegionDatos = {
  clientes: number;
  riesgo: number;
  plan: number[];
  nivel: { Alto: number; Medio: number; Bajo: number };
  seg: number[];
  meses: number[];
};
export type CockpitDatos = {
  D: Record<string, RegionDatos>;
  kpi: { churn_pct: number | null; riesgo_alto: number; mrr_riesgo: number; prob_alto: number | null; auc: string | null };
};
export type Cliente = {
  id: string; nombre: string; ciudad: string; pais: string;
  anios: number; plan: string; prob: number; factor: string;
};
export type Tabla = { columnas: string[]; filas: (string | null)[][]; total: number };
export type Respuesta = {
  ok: boolean; respuesta: string; especialista?: string; metodo?: string; tabla?: Tabla | null; sql?: string | null;
};
export type Email = {
  ok: boolean; error?: string; id_cliente?: string; email?: string;
  perfil?: { nombre: string; ciudad: string; plan: string; anios: number; prob: number; factor: string };
  ofertas?: { descuento: string; internet: string; factor: string };
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export const api = {
  cockpitDatos: () => req<CockpitDatos>("/cockpit/datos"),
  explicar: (grafico: string, region: string, datos: unknown) =>
    req<{ texto: string }>("/cockpit/explicar", { method: "POST", body: JSON.stringify({ grafico, region, datos }) }),
  preguntar: (pregunta: string) =>
    req<Respuesta>("/asistente/preguntar", { method: "POST", body: JSON.stringify({ pregunta }) }),
  retencionLista: () => req<{ clientes: Cliente[] }>("/retencion/lista"),
  generarEmail: (id_cliente: string) =>
    req<Email>("/retencion/email", { method: "POST", body: JSON.stringify({ id_cliente }) }),
};

// Formatos en español latinoamericano (es-419).
export const nf = (n: number) => n.toLocaleString("es-419");
export const pc = (n: number) => n.toLocaleString("es-419", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
export const usd = (n: number) =>
  new Intl.NumberFormat("es-419", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
export const iniciales = (nombre: string) =>
  (nombre || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

// Paleta de avatares (gradientes) asignada de forma estable por id.
const AVATARES = [
  "linear-gradient(135deg,#ff5a36,#ff3d8b)", "linear-gradient(135deg,#8b5cf6,#22d3ee)",
  "linear-gradient(135deg,#ff3d8b,#8b5cf6)", "linear-gradient(135deg,#22d3ee,#34d399)",
  "linear-gradient(135deg,#fbbf24,#ff5a36)",
];
export const avatarBg = (id: string) => AVATARES[[...(id || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATARES.length];
