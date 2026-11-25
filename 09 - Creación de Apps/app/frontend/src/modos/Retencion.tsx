// Pestaña Retención: lista de clientes en riesgo alto (UC) + perfil y ofertas de get_cliente_360(id)
// + e-mail redactado por el model service del Unity Gateway. "Enviar a CRM" saca al cliente de la lista
// (estado local de la demo).
import { useEffect, useState } from "react";
import {
  Search, Wand2, Send, RefreshCw, CheckCircle2, Percent, Wifi, UserCheck, GraduationCap, PhoneCall, Receipt,
  MapPin, CalendarDays, Layers, Loader2, Mail, Target,
} from "lucide-react";
import { api, avatarBg, iniciales } from "../api";
import type { Cliente, Email } from "../api";

const FACTOR_ICON: Record<string, typeof UserCheck> = {
  "Insatisfacción (CSAT)": UserCheck,
  "Morosidad": Receipt,
  "Bajo uso": GraduationCap,
  "Detractor (NPS)": PhoneCall,
};

export function Retencion() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [input, setInput] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState<Email | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => { api.retencionLista().then((r) => setClientes(r.clientes)).catch(() => setClientes([])); }, []);

  const avisar = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3200); };

  async function generar(idArg?: string) {
    const id = (idArg ?? input).trim().toUpperCase();
    if (!id) return;
    setSel(id); setInput(id); setCargando(true); setRes(null);
    try {
      const r = await api.generarEmail(id);
      if (!r.ok) avisar(r.error || "ID no encontrado en la base de riesgo.");
      else setRes(r);
    } catch {
      avisar("Falló la generación del e-mail. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  function enviarCrm() {
    if (!res?.id_cliente) return;
    const nombre = res.perfil?.nombre || res.id_cliente;
    setClientes((cs) => (cs || []).filter((c) => c.id !== res.id_cliente));
    avisar(`E-mail de ${nombre} enviado al CRM. El cliente salió de la lista de riesgo.`);
    setRes(null); setSel(null); setInput("");
  }

  const p = res?.perfil;
  const FactorIcon = FACTOR_ICON[p?.factor || ""] || PhoneCall;

  return (
    <div className="ret">
      <div>
        <div className="search">
          <div className="field">
            <Search size={16} />
            <input value={input} placeholder="ID del cliente (ej.: C01575)" onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generar()} />
          </div>
          <button className="btn primary" onClick={() => generar()} disabled={cargando || !input.trim()}>
            <Wand2 size={16} /> Generar
          </button>
        </div>
        <div className="card">
          <div className="card-hd">
            <div><div className="eyebrow prev"><i />Predicción · riesgo alto</div><h3>Clientes con mayor propensión a cancelar</h3></div>
            <span className="chip">{clientes?.length ?? 0}</span>
          </div>
          {!clientes && <div className="loading"><Loader2 size={16} className="spin" /> Cargando clientes…</div>}
          <div className="clients">
            {clientes?.map((c) => {
              const FI = FACTOR_ICON[c.factor] || PhoneCall;
              return (
                <button key={c.id} className={`client ${sel === c.id ? "on" : ""}`} onClick={() => generar(c.id)}>
                  <div className="initials" style={{ background: avatarBg(c.id) }}>{iniciales(c.nombre)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="n">{c.nombre}</div>
                    <div className="s"><MapPin size={11} /> {c.ciudad} · {c.plan} · <FI size={11} /> {c.factor}</div>
                  </div>
                  <div className="prob">
                    <b>{c.prob}%</b>
                    <div className="track"><div className="fill" style={{ width: `${c.prob}%` }} /></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card detail">
        {!res && !cargando && (
          <div className="empty">
            <div>
              <div className="ic"><Target size={26} /></div>
              <b>Elige un cliente de la lista</b>
              <p style={{ margin: "6px 0 0" }}>Verás su perfil, las ofertas que decidió la regla de negocio y el e-mail listo para enviar.</p>
            </div>
          </div>
        )}
        {cargando && (
          <div>
            <div className="hint" style={{ marginBottom: 14 }}><Loader2 size={14} className="spin" /> Consultando get_cliente_360 y redactando con el Unity Gateway…</div>
            {[96, 88, 92, 60, 84, 70].map((w, i) => <div key={i} className="shimmer" style={{ width: `${w}%`, height: 12 }} />)}
          </div>
        )}
        {res && p && res.ofertas && (
          <>
            <div className="hd">
              <div className="initials" style={{ background: avatarBg(res.id_cliente || "") }}>{iniciales(p.nombre)}</div>
              <div>
                <h2>{p.nombre}</h2>
                <div className="hint" style={{ marginTop: 4 }}>
                  <MapPin size={12} /> {p.ciudad} &nbsp;<Layers size={12} /> {p.plan} &nbsp;<CalendarDays size={12} /> {p.anios} años
                </div>
              </div>
              <span className="chip hot" style={{ marginLeft: "auto" }}><FactorIcon size={12} /> {p.factor} · {p.prob}%</span>
            </div>

            <div className="offers">
              <div className="offer">
                <div className="ic" style={{ background: "rgba(255,90,54,.15)", color: "#ff5a36" }}><Percent size={16} /></div>
                <span>Antigüedad</span><b>Descuento de {res.ofertas.descuento}</b>
              </div>
              <div className="offer">
                <div className="ic" style={{ background: "rgba(34,211,238,.13)", color: "#22d3ee" }}><Wifi size={16} /></div>
                <span>Plan</span><b>{res.ofertas.internet}</b>
              </div>
              <div className="offer">
                <div className="ic" style={{ background: "rgba(139,92,246,.16)", color: "#a78bfa" }}><FactorIcon size={16} /></div>
                <span>Motivo</span><b>{res.ofertas.factor}</b>
              </div>
            </div>

            <div className="mail">
              <div className="bar">
                <div><Mail size={12} style={{ verticalAlign: -2 }} /> <b>Para:</b> {p.nombre} &lt;{(res.id_cliente || "").toLowerCase()}@cliente.com&gt;</div>
                <div><b>Asunto:</b> Una oferta especial para que sigas con nosotros</div>
              </div>
              <pre>{res.email}</pre>
            </div>

            <div className="actions">
              <button className="btn primary" onClick={enviarCrm}><Send size={16} /> Enviar a CRM</button>
              <button className="btn soft" onClick={() => generar(res.id_cliente)}><RefreshCw size={15} /> Regenerar</button>
              <span className="hint">Ofertas: get_cliente_360('{res.id_cliente}') · texto: Unity Gateway</span>
            </div>
          </>
        )}
      </div>

      <div className={`toast ${toast ? "show" : ""}`}><CheckCircle2 size={18} /> {toast}</div>
    </div>
  );
}
