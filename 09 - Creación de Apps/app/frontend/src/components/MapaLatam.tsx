// Mapa de LATAM (Leaflet + tiles oscuros de ArcGIS, sin API key). Una burbuja por región: tamaño según el número de
// clientes, color propio de la región, número = clientes en riesgo Alto. Clic selecciona la región.
import { useEffect, useRef } from "react";
import L from "leaflet";
import type { RegionDatos } from "../api";
import { nf } from "../api";

export const GEO: Record<string, [number, number]> = {
  "México": [23, -102],
  "Centroamérica": [12, -85.5],
  "Caribe": [18.6, -70.5],
  "Andina": [-3, -76],
  "Cono Sur": [-33, -63],
};
export const COLOR: Record<string, string> = {
  "México": "#ff5a36",
  "Andina": "#ff3d8b",
  "Cono Sur": "#8b5cf6",
  "Centroamérica": "#22d3ee",
  "Caribe": "#fbbf24",
};

type Props = { D: Record<string, RegionDatos>; seleccionada: string; onSelect: (reg: string) => void };

export function MapaLatam({ D, seleccionada, onSelect }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const icono = (reg: string, sel: boolean) => {
    const d = D[reg];
    const size = Math.max(34, Math.min(74, Math.round(30 + (d.clientes / 900) * 44)));
    return L.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<div class="burbuja ${sel ? "sel" : ""}" style="--c:${COLOR[reg]};width:${size}px;height:${size}px;font-size:${size > 50 ? 14 : 12}px">${d.riesgo}</div>`,
    });
  };

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const m = L.map(elRef.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 12 }).addTo(m);
    m.fitBounds([[27, -110], [-38, -58]]);
    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; markersRef.current = {}; };
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !D?.["México"]) return;
    Object.values(markersRef.current).forEach((mk) => mk.remove());
    markersRef.current = {};
    Object.keys(GEO).forEach((reg) => {
      const mk = L.marker(GEO[reg], { icon: icono(reg, reg === seleccionada) }).addTo(m);
      mk.bindTooltip(`<b>${reg}</b><br>${nf(D[reg].clientes)} clientes · ${nf(D[reg].riesgo)} en riesgo alto`, { direction: "top", offset: [0, -8] });
      mk.on("click", () => onSelectRef.current(reg));
      markersRef.current[reg] = mk;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [D]);

  useEffect(() => {
    Object.keys(markersRef.current).forEach((reg) => markersRef.current[reg].setIcon(icono(reg, reg === seleccionada)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionada, D]);

  return <div id="latmap" ref={elRef} />;
}
