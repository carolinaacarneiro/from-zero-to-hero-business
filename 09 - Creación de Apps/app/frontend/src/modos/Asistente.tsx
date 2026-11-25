// Pestaña Asistente: un router elige al especialista (Facturación o Soporte) y pregunta a su
// Genie Agent (Ej. 07). El chat muestra quién respondió, cómo se eligió, la tabla y el SQL.
import { useEffect, useRef, useState } from "react";
import { Bot, User, Send, Receipt, Headset, Code2, Sparkles, Route, AlertCircle } from "lucide-react";
import { api } from "../api";
import type { Respuesta } from "../api";

type Msg = { de: "u" | "a"; texto: string; r?: Respuesta };

const SUGERENCIAS = [
  { icon: Headset, q: "¿Cuál es el NPS promedio por canal de atención?" },
  { icon: Receipt, q: "¿Cuál es el monto total de facturas sin pagar?" },
  { icon: Headset, q: "¿Cuál es el CSAT promedio por categoría de ticket?" },
  { icon: Receipt, q: "¿Cuál es el porcentaje de facturas no pagadas por plan?" },
];

function Especialista({ nombre }: { nombre?: string }) {
  if (!nombre) return null;
  const Icon = nombre === "Soporte" ? Headset : Receipt;
  return <span className={`chip ${nombre === "Soporte" ? "cool" : "hot"}`}><Icon size={12} /> Genie de {nombre}</span>;
}

export function Asistente() {
  const [msgs, setMsgs] = useState<Msg[]>([{
    de: "a",
    texto: "Hola. Puedo responder preguntas sobre facturación y sobre soporte de los clientes. Yo elijo al especialista correcto por ti.",
  }]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const fin = useRef<HTMLDivElement | null>(null);
  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, cargando]);

  async function enviar(texto?: string) {
    const v = (texto ?? input).trim();
    if (!v || cargando) return;
    setMsgs((m) => [...m, { de: "u", texto: v }]);
    setInput("");
    setCargando(true);
    try {
      const r = await api.preguntar(v);
      setMsgs((m) => [...m, { de: "a", texto: r.respuesta, r }]);
    } catch {
      setMsgs((m) => [...m, { de: "a", texto: "Falló la consulta. Inténtalo de nuevo.", r: { ok: false, respuesta: "" } }]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="card chat">
      <div className="chat-hd">
        <div className="avatar bot"><Bot size={18} color="#fff" /></div>
        <div>
          <b>Asistente multi-agente</b>
          <div className="hint" style={{ marginTop: 2 }}><Route size={12} /> Un router elige entre tus Genie Agents del Ej. 07</div>
        </div>
        <div className="spec">
          <span className="chip hot"><Receipt size={12} /> Facturación</span>
          <span className="chip cool"><Headset size={12} /> Soporte</span>
        </div>
      </div>

      <div className="msgs">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.de}`}>
            <div className={`avatar ${m.de === "u" ? "user" : "bot"}`}>
              {m.de === "u" ? <User size={16} /> : <Bot size={16} color="#fff" />}
            </div>
            <div style={{ minWidth: 0 }}>
              {m.r && (
                <div className="meta">
                  {m.r.ok ? (
                    <>
                      <Especialista nombre={m.r.especialista} />
                      <span className="hint"><Sparkles size={11} /> elegido por {m.r.metodo === "ia" ? "la IA (Unity Gateway)" : "palabras clave"}</span>
                    </>
                  ) : (
                    <span className="chip"><AlertCircle size={12} /> Sin respuesta{m.r.especialista ? ` del Genie de ${m.r.especialista}` : ""}</span>
                  )}
                </div>
              )}
              <div className="bubble">
                {m.texto}
                {m.r?.tabla && (
                  <table className="tbl">
                    <thead><tr>{m.r.tabla.columnas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {m.r.tabla.filas.map((f, j) => (
                        <tr key={j}>{f.map((v, k) => {
                          const n = Number(v);
                          return <td key={k}>{v != null && v !== "" && Number.isFinite(n) && !Number.isInteger(n) ? n.toLocaleString("es-419", { maximumFractionDigits: 2 }) : v}</td>;
                        })}</tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {m.r?.sql && (
                  <details className="sql-toggle">
                    <summary className="hint" style={{ cursor: "pointer" }}><Code2 size={12} /> Ver el SQL que escribió Genie</summary>
                    <pre>{m.r.sql}</pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
        {cargando && (
          <div className="msg a">
            <div className="avatar bot"><Bot size={16} color="#fff" /></div>
            <div className="bubble"><span className="typing"><i /><i /><i /></span> &nbsp;eligiendo al especialista y consultando al Genie…</div>
          </div>
        )}
        <div ref={fin} />
      </div>

      <div>
        {msgs.length <= 1 && (
          <div className="sugs">
            {SUGERENCIAS.map((s) => (
              <button key={s.q} className="sug" onClick={() => enviar(s.q)}><s.icon size={13} /> {s.q}</button>
            ))}
          </div>
        )}
        <div className="composer">
          <input value={input} disabled={cargando} placeholder="Escribe tu pregunta de negocio…"
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()} />
          <button className="btn primary" onClick={() => enviar()} disabled={cargando || !input.trim()}>
            <Send size={16} /> Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
