import { useEffect, useRef } from "react";
import { useConfig } from "../state/config";

export type MapTone = "ignition" | "red" | "green" | "amber";

export interface MapPoint {
  lat: number;
  lng: number;
  title: string;
  sub?: string;
  danger?: boolean; // back-compat: red + pulse
  tone?: MapTone;
  pulse?: boolean;
  href?: string;
}

const TONE_COLOR: Record<MapTone, string> = {
  ignition: "#FF4D14",
  red: "#FF3B4E",
  green: "#22C55E",
  amber: "#F59E0B",
};
const resolveTone = (p: MapPoint): MapTone => p.tone ?? (p.danger ? "red" : "ignition");

let mapboxCssInjected = false;
function injectMapboxCss() {
  if (mapboxCssInjected || document.getElementById("mapbox-gl-css")) return;
  const link = document.createElement("link");
  link.id = "mapbox-gl-css";
  link.rel = "stylesheet";
  link.href = "https://api.mapbox.com/mapbox-gl-js/v3.9.1/mapbox-gl.css";
  document.head.appendChild(link);
  mapboxCssInjected = true;
}

export function MapView({
  points,
  className = "",
  height = 420,
}: {
  points: MapPoint[];
  className?: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { mapboxToken: token, loaded } = useConfig();

  useEffect(() => {
    if (!token || !ref.current || points.length === 0) return;
    let map: any;
    let cancelled = false;

    (async () => {
      injectMapboxCss();
      const mod = await import("mapbox-gl");
      const mapboxgl = mod.default;
      if (cancelled || !ref.current) return;
      mapboxgl.accessToken = token;

      const lats = points.map((p) => p.lat);
      const lngs = points.map((p) => p.lng);
      const center: [number, number] = [
        lngs.reduce((a, b) => a + b, 0) / lngs.length,
        lats.reduce((a, b) => a + b, 0) / lats.length,
      ];

      map = new mapboxgl.Map({
        container: ref.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center,
        zoom: 4.2,
        attributionControl: false,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      for (const p of points) {
        const tone = resolveTone(p);
        const color = TONE_COLOR[tone];
        const pulse = p.pulse ?? p.danger ?? false;
        const el = document.createElement("div");
        const rgb =
          tone === "red" ? "255,59,78" : tone === "green" ? "34,197,94" : tone === "amber" ? "245,158,11" : "255,77,20";
        el.style.cssText = `width:16px;height:16px;border-radius:50%;cursor:pointer;border:2px solid #07080B;box-shadow:0 0 0 2px rgba(${rgb},.6);background:${color};`;
        if (pulse) el.style.animation = "pulse-live 1.6s ease-in-out infinite";
        const popup = new mapboxgl.Popup({ offset: 16, closeButton: false }).setHTML(
          `<div style="font-family:Inter,sans-serif;color:#0A0C11;min-width:140px">
             <strong>${p.title}</strong>${p.sub ? `<br><span style="opacity:.7;font-size:12px">${p.sub}</span>` : ""}
             ${p.href ? `<br><a href="${p.href}" style="color:#E63A05;font-size:12px;font-weight:600">View →</a>` : ""}
           </div>`,
        );
        new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
      }

      if (points.length > 1) {
        const b = new mapboxgl.LngLatBounds();
        points.forEach((p) => b.extend([p.lng, p.lat]));
        map.fitBounds(b, { padding: 60, maxZoom: 7, duration: 0 });
      }
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [token, points]);

  if (loaded && !token) {
    // No token configured — graceful, on-brand fallback list.
    return (
      <div className={`panel p-5 ${className}`} style={{ minHeight: height }}>
        <div className="mb-3 flex items-center gap-2 text-sm text-white/50">
          <span>🗺️</span> Map view activates once a Mapbox token is configured.
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {points.map((p, i) => (
            <a
              key={i}
              href={p.href || "#"}
              className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-carbon-850 p-3"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: TONE_COLOR[resolveTone(p)] }}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{p.title}</div>
                {p.sub && <div className="truncate text-xs text-white/45">{p.sub}</div>}
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-2xl border border-white/10 ${className}`}
      style={{ height }}
    />
  );
}
