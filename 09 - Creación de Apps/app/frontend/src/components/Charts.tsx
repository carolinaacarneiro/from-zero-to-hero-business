// Gráficos del Cockpit (Recharts) con la paleta de la app.
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList,
} from "recharts";
import { nf } from "../api";

const tip = {
  contentStyle: { background: "#111733", border: "1px solid rgba(255,255,255,.14)", borderRadius: 10, color: "#eef1f8", fontSize: 12 },
  itemStyle: { color: "#eef1f8" },
  labelStyle: { color: "#8d96ad" },
  cursor: { fill: "rgba(255,255,255,.04)" },
};

export function BarrasH({ labels, vals, id }: { labels: string[]; vals: number[]; id: string }) {
  const data = labels.map((l, i) => ({ l, v: vals[i] }));
  return (
    <ResponsiveContainer width="100%" height={44 * labels.length + 10}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 46, top: 4, bottom: 4 }} barCategoryGap={10}>
        <defs>
          <linearGradient id={`g-${id}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="0.6" stopColor="#ff3d8b" />
            <stop offset="1" stopColor="#ff5a36" />
          </linearGradient>
        </defs>
        <XAxis type="number" hide domain={[0, 40]} />
        <YAxis type="category" dataKey="l" width={92} tick={{ fill: "#8d96ad", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip {...tip} formatter={(v: number) => [`${v.toFixed(1)}%`, "churn"]} />
        <Bar dataKey="v" fill={`url(#g-${id})`} radius={[0, 8, 8, 0]} background={{ fill: "rgba(255,255,255,.04)", radius: 8 }} animationDuration={700}>
          <LabelList dataKey="v" position="right" formatter={(v: number) => `${v.toFixed(1)}%`} fill="#eef1f8" fontSize={12} fontWeight={600} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const NIVELES = [
  { k: "Alto", c: "#ff3d8b" },
  { k: "Medio", c: "#fbbf24" },
  { k: "Bajo", c: "#34d399" },
] as const;

export function Dona({ nivel }: { nivel: { Alto: number; Medio: number; Bajo: number } }) {
  const tot = nivel.Alto + nivel.Medio + nivel.Bajo || 1;
  const data = NIVELES.map((n) => ({ name: n.k, value: nivel[n.k], c: n.c }));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative", height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none" animationDuration={700}>
              {data.map((d) => <Cell key={d.name} fill={d.c} />)}
            </Pie>
            <Tooltip {...tip} formatter={(v: number, n: string) => [nf(v), n]} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
          <div><b style={{ fontSize: 24, letterSpacing: "-.02em" }}>{nf(nivel.Alto)}</b><div style={{ fontSize: 11, color: "#8d96ad" }}>riesgo alto</div></div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.c, boxShadow: `0 0 12px ${d.c}` }} />
            <span style={{ color: "#8d96ad" }}>{d.name}</span>
            <b style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{nf(d.value)}</b>
            <span style={{ width: 42, textAlign: "right", color: "#5d6680" }}>{Math.round((d.value / tot) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MESES = ["sep", "oct", "nov", "dic", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago"];

export function Linea({ data }: { data: number[] }) {
  const d = data.map((v, i) => ({ m: MESES[i], v }));
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={d} margin={{ left: -18, right: 8, top: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#22d3ee" stopOpacity={0.45} />
            <stop offset="1" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="trazo" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <XAxis dataKey="m" tick={{ fill: "#8d96ad", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#5d6680", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...tip} formatter={(v: number) => [v, "cancelaciones"]} />
        <Area type="monotone" dataKey="v" stroke="url(#trazo)" strokeWidth={2.6} fill="url(#area)"
          dot={{ r: 3, fill: "#0c1122", stroke: "#22d3ee", strokeWidth: 2 }} activeDot={{ r: 5 }} animationDuration={800} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
