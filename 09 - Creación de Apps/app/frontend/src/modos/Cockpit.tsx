// Pestaña Cockpit: KPIs + mapa de LATAM + panel de región + 4 gráficos filtrables, cada uno con
// "Explicar con IA" (model service del Unity Gateway).
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TrendingDown, AlertTriangle, Banknote, Gauge, Sparkles, X, Globe2, Loader2, MapPin } from "lucide-react";
import { api, nf, pc, usd } from "../api";
import type { CockpitDatos, RegionDatos } from "../api";
import { MapaLatam, COLOR } from "../components/MapaLatam";
import { BarrasH, Dona, Linea } from "../components/Charts";

const PLANES = ["Básico", "Estándar", "Premium", "Empresarial"];
const SEGS = ["Consumidor", "PyME", "Corporativo"];
const MESESF = ["sep/24", "oct/24", "nov/24", "dic/24", "ene/25", "feb/25", "mar/25", "abr/25", "may/25", "jun/25", "jul/25", "ago/25"];
const REGIONES = ["México", "Andina", "Cono Sur", "Centroamérica", "Caribe"];

type ChartId = "plan" | "nivel" | "meses" | "seg";

function VizCard({ tag, titulo, grafico, region, datosIA, children }: {
  tag: "retro" | "prev"; titulo: string; grafico: ChartId; region: string; datosIA: unknown; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [texto, setTexto] = useState("");

  async function cargar() {
    setLoading(true);
    try {
      setTexto((await api.explicar(grafico, region, datosIA)).texto);
    } catch {
      setTexto("No fue posible generar la lectura de la IA en este momento.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setTexto("");
    if (open) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  return (
    <div className="card">
      <div className="card-hd">
        <div>
          <div className={`eyebrow ${tag}`}><i />{tag === "retro" ? "Retrospectiva" : "Predicción"}</div>
          <h3>{titulo}</h3>
        </div>
        <button className="ai-btn" onClick={() => { const n = !open; setOpen(n); if (n && !texto && !loading) cargar(); }}>
          {open ? <X size={14} /> : <Sparkles size={14} />}
          {open ? "Ocultar" : "Explicar con IA"}
        </button>
      </div>
      {children}
      {open && (
        <div className="ai-read">
          <div className="who"><Sparkles size={12} /> Lectura de la IA</div>
          {loading ? <><div className="shimmer" style={{ width: "92%" }} /><div className="shimmer" style={{ width: "70%" }} /></> : texto}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, lbl, val, foot, accent, soft }: {
  icon: typeof Gauge; lbl: string; val: ReactNode; foot: ReactNode; accent: string; soft: string;
}) {
  return (
    <div className="card kpi" style={{ ["--accent" as string]: accent, ["--soft" as string]: soft, ["--glow" as string]: soft }}>
      <div className="kpi-ic"><Icon size={19} strokeWidth={2.2} /></div>
      <div className="lbl">{lbl}</div>
      <div className="val">{val}</div>
      <div className="foot">{foot}</div>
    </div>
  );
}

export function Cockpit() {
  const [datos, setDatos] = useState<CockpitDatos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reg, setReg] = useState("LATAM");

  useEffect(() => { api.cockpitDatos().then(setDatos).catch((e) => setError(String(e))); }, []);
  const d: RegionDatos | null = useMemo(() => (datos ? datos.D[reg] : null), [datos, reg]);

  if (error) return <div className="card">Error al cargar los datos: {error}</div>;
  if (!datos || !d) return <div className="loading"><Loader2 size={18} className="spin" /> Cargando panorama de churn…</div>;

  const k = datos.kpi;
  const tasa = d.clientes ? (d.riesgo / d.clientes) * 100 : 0;

  return (
    <>
      <div className="kpis">
        <Kpi icon={TrendingDown} lbl="Churn histórico" accent="#ff5a36" soft="rgba(255,90,54,.16)"
          val={k.churn_pct == null ? "—" : `${k.churn_pct}%`} foot={<><span className="chip">LATAM</span> {nf(2000)} suscripciones</>} />
        <Kpi icon={AlertTriangle} lbl="Clientes en riesgo alto" accent="#ff3d8b" soft="rgba(255,61,139,.16)"
          val={nf(k.riesgo_alto)} foot={k.prob_alto == null ? "probabilidad ≥ 50%" : `probabilidad promedio ${Math.round(k.prob_alto * 100)}%`} />
        <Kpi icon={Banknote} lbl="MRR en riesgo" accent="#fbbf24" soft="rgba(251,191,36,.14)"
          val={usd(k.mrr_riesgo)} foot="ingreso mensual en juego" />
        <Kpi icon={Gauge} lbl="Calidad del modelo" accent="#34d399" soft="rgba(52,211,153,.14)"
          val={k.auc ? `AUC ${k.auc}` : "—"} foot={<><span className="chip ok">Ej. 06</span> predicción de churn</>} />
      </div>

      <div className="grid-map">
        <div className="card">
          <div className="card-hd">
            <div><div className="eyebrow prev"><i />Predicción</div><h3>Clientes en riesgo por región</h3></div>
            <span className="hint"><MapPin size={13} /> Haz clic en una región</span>
          </div>
          <MapaLatam D={datos.D} seleccionada={reg} onSelect={setReg} />
          <div className="legend-scale"><span>el número en cada círculo = clientes en riesgo alto</span></div>
        </div>
        <div className="card region">
          <div className="card-hd">
            <div><div className="eyebrow"><Globe2 size={11} /> Región</div></div>
            {reg !== "LATAM" && <button className="ghost" onClick={() => setReg("LATAM")}><X size={13} /> Ver LATAM</button>}
          </div>
          <div className="big">{reg === "LATAM" ? "LATAM · todas las regiones" : reg}</div>
          <div className="rstats">
            <div className="rstat"><b>{nf(d.clientes)}</b><span>clientes</span></div>
            <div className="rstat hot"><b>{nf(d.riesgo)}</b><span>riesgo alto</span></div>
            <div className="rstat"><b>{pc(tasa)}</b><span>tasa de riesgo</span></div>
          </div>
          <div className="region-list">
            {REGIONES.map((r) => (
              <button key={r} className={`region-row ${reg === r ? "on" : ""}`} onClick={() => setReg(r)}>
                <span className="dot" style={{ background: COLOR[r], boxShadow: `0 0 10px ${COLOR[r]}` }} />
                {r}
                <b>{nf(datos.D[r].riesgo)}</b>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-viz">
        <VizCard tag="retro" titulo="Churn por plan" grafico="plan" region={reg} datosIA={{ planes: PLANES, churn_pct: d.plan }}>
          <BarrasH id="plan" labels={PLANES} vals={d.plan} />
        </VizCard>
        <VizCard tag="prev" titulo="Clientes por nivel de riesgo" grafico="nivel" region={reg} datosIA={d.nivel}>
          <Dona nivel={d.nivel} />
        </VizCard>
        <VizCard tag="retro" titulo="Cancelaciones por mes" grafico="meses" region={reg} datosIA={{ meses: MESESF, cancelaciones: d.meses }}>
          <Linea data={d.meses} />
        </VizCard>
        <VizCard tag="retro" titulo="Churn por segmento" grafico="seg" region={reg} datosIA={{ segmentos: SEGS, churn_pct: d.seg }}>
          <BarrasH id="seg" labels={SEGS} vals={d.seg} />
        </VizCard>
      </div>
    </>
  );
}
