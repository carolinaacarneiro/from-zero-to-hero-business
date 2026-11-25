// Central de Retención — layout con navegación lateral: Cockpit, Asistente y Retención.
import { useState } from "react";
import { LayoutDashboard, MessagesSquare, Target, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { Cockpit } from "./modos/Cockpit";
import { Asistente } from "./modos/Asistente";
import { Retencion } from "./modos/Retencion";

type Vista = "cockpit" | "asistente" | "retencion";

const VISTAS = [
  { id: "cockpit" as Vista, label: "Cockpit", hint: "Ej. 06", icon: LayoutDashboard,
    titulo: "Panorama de churn", sub: "Riesgo por región, segmento y plan, con lectura por IA en cada gráfico." },
  { id: "asistente" as Vista, label: "Asistente", hint: "Ej. 07", icon: MessagesSquare,
    titulo: "Asistente de negocio", sub: "Pregunta en español: el router elige al especialista y tu Genie Agent responde." },
  { id: "retencion" as Vista, label: "Retención", hint: "Ej. 08", icon: Target,
    titulo: "Retención personalizada", sub: "La regla de negocio decide la oferta; la IA solo redacta el e-mail." },
];

export default function App() {
  const [vista, setVista] = useState<Vista>("cockpit");
  const v = VISTAS.find((x) => x.id === vista)!;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark"><Radar size={22} color="#fff" strokeWidth={2.2} /></div>
          <div><b>Central de Retención</b><span>From Zero to Hero</span></div>
        </div>
        <nav className="nav">
          <div className="nav-lbl">Navegación</div>
          {VISTAS.map((x) => (
            <button key={x.id} className={vista === x.id ? "on" : ""} onClick={() => setVista(x.id)}>
              <x.icon size={18} strokeWidth={2} />
              {x.label}
              <small>{x.hint}</small>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="trust">
            <ShieldCheck size={16} />
            <div><b>Con tu identidad.</b> Cada consulta y cada llamada de IA usa tus permisos de Unity Catalog.</div>
          </div>
          <div className="trust">
            <Sparkles size={16} style={{ color: "var(--pink)" }} />
            <div><b>IA gobernada.</b> Todo pasa por tu model service del Unity Gateway, con registro de cada llamada.</div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="top">
          <div>
            <h1>{v.titulo}</h1>
            <p>{v.sub}</p>
          </div>
          <span className="status"><i /> Conectado a Unity Catalog</span>
        </div>
        {vista === "cockpit" && <Cockpit />}
        {vista === "asistente" && <Asistente />}
        {vista === "retencion" && <Retencion />}
      </main>
    </div>
  );
}
