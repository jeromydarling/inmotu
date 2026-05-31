import { useEffect, useRef, useState } from "react";
import { useConfig } from "../state/config";
import type { VenuePin } from "../api/client";

// The national canvas. Renders thousands of venue pins via Mapbox GL's native
// GeoJSON clustering (GPU-fast at scale), with per-category color layers, a
// pulsing "live" halo, fly-to interactions, and a glassy dark style. This is
// the showpiece — built to push Mapbox as far as it goes while staying smooth.

export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  road: { label: "Road course", color: "#FF4D14" },     // ignition
  oval: { label: "Oval / dirt", color: "#F59E0B" },      // amber
  motocross: { label: "Motocross", color: "#22C55E" },   // green
  drag: { label: "Drag strip", color: "#3B82F6" },       // blue
  karting: { label: "Karting", color: "#A855F7" },       // purple
  circuit: { label: "Circuit", color: "#94A3B8" },       // slate
};

let cssInjected = false;
function injectCss() {
  if (cssInjected || document.getElementById("mapbox-gl-css")) return;
  const link = document.createElement("link");
  link.id = "mapbox-gl-css";
  link.rel = "stylesheet";
  link.href = "https://api.mapbox.com/mapbox-gl-js/v3.9.1/mapbox-gl.css";
  document.head.appendChild(link);
  cssInjected = true;
}

function toFeatureCollection(venues: VenuePin[]) {
  return {
    type: "FeatureCollection" as const,
    features: venues.map((v) => ({
      type: "Feature" as const,
      properties: {
        id: v.id,
        name: v.name,
        category: v.category,
        color: (CATEGORY_META[v.category] ?? CATEGORY_META.circuit).color,
        sub: [v.city, v.state].filter(Boolean).join(", "),
        endangered: v.status === "endangered" ? 1 : 0,
        website: v.website ?? "",
      },
      geometry: { type: "Point" as const, coordinates: [v.lng, v.lat] },
    })),
  };
}

export function VenueMap({
  venues,
  className = "",
  height = 560,
  onSelect,
  intro = true,
}: {
  venues: VenuePin[];
  className?: string;
  height?: number | string;
  onSelect?: (id: string) => void;
  intro?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const { mapboxToken: token, loaded } = useConfig();
  const [ready, setReady] = useState(false);

  // Build the map once.
  useEffect(() => {
    if (!token || !ref.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      injectCss();
      const mod = await import("mapbox-gl");
      const mapboxgl = mod.default;
      if (cancelled || !ref.current) return;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: ref.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-96, 38.5],
        zoom: intro ? 2.6 : 3.6,
        minZoom: 2,
        maxZoom: 15,
        attributionControl: false,
        projection: "globe" as any,
        antialias: true,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("style.load", () => {
        // Subtle atmospheric glow on the globe.
        map.setFog({
          color: "rgb(10,12,17)",
          "high-color": "rgb(20,24,38)",
          "horizon-blend": 0.08,
          "space-color": "rgb(5,6,10)",
          "star-intensity": 0.5,
        });
      });

      map.on("load", () => {
        if (cancelled) return;
        map.addSource("venues", {
          type: "geojson",
          data: toFeatureCollection(venues),
          cluster: true,
          clusterMaxZoom: 8,
          clusterRadius: 48,
        });

        // ── Clusters: glowing ignition orbs that grow with count ──
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "venues",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#FF4D14",
            "circle-opacity": 0.85,
            "circle-radius": ["step", ["get", "point_count"], 16, 25, 22, 100, 30, 500, 40],
            "circle-stroke-width": 2,
            "circle-stroke-color": "rgba(255,77,20,0.35)",
            "circle-blur": 0.2,
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "venues",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
            "text-size": 13,
          },
          paint: { "text-color": "#0A0C11" },
        });

        // ── Unclustered: category-colored points with a dark rim ──
        map.addLayer({
          id: "venue-point",
          type: "circle",
          source: "venues",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4, 10, 7, 14, 10],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#07080B",
            "circle-opacity": 0.95,
          },
        });
        // Endangered venues get a red pulsing halo (separate layer under points).
        map.addLayer(
          {
            id: "venue-endangered",
            type: "circle",
            source: "venues",
            filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "endangered"], 1]],
            paint: {
              "circle-color": "#FF3B4E",
              "circle-radius": 16,
              "circle-opacity": 0.25,
              "circle-blur": 0.6,
            },
          },
          "venue-point",
        );

        // ── Interactions ──
        map.on("click", "clusters", (e: any) => {
          const f: any = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
          const cid = f.properties.cluster_id;
          (map.getSource("venues") as any).getClusterExpansionZoom(cid, (err: any, zoom: number) => {
            if (err) return;
            map.easeTo({ center: f.geometry.coordinates, zoom: zoom + 0.4, duration: 600 });
          });
        });
        const popup = new mapboxgl.Popup({ offset: 14, closeButton: false, className: "venue-popup" });
        map.on("mouseenter", "venue-point", (e: any) => {
          map.getCanvas().style.cursor = "pointer";
          const f = e.features[0];
          const p = f.properties;
          popup
            .setLngLat(f.geometry.coordinates)
            .setHTML(
              `<div style="font-family:Inter,sans-serif;color:#0A0C11;min-width:150px">
                 <div style="font-weight:700">${p.name}</div>
                 <div style="opacity:.65;font-size:12px">${(CATEGORY_META[p.category] ?? CATEGORY_META.circuit).label}${p.sub ? ` · ${p.sub}` : ""}</div>
               </div>`,
            )
            .addTo(map);
        });
        map.on("mouseleave", "venue-point", () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });
        map.on("click", "venue-point", (e: any) => {
          const id = e.features[0].properties.id;
          if (onSelect) onSelect(id);
        });

        setReady(true);

        // Cinematic intro: spin the globe in, then settle on the US.
        if (intro) {
          map.easeTo({ center: [-96, 38.5], zoom: 3.7, duration: 4200, easing: (t: number) => t * (2 - t) });
        }
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [token]);

  // Push new data into the live source when venues change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("venues");
    if (src) src.setData(toFeatureCollection(venues));
  }, [venues, ready]);

  if (loaded && !token) {
    return (
      <div className={`panel flex items-center justify-center ${className}`} style={{ minHeight: height }}>
        <div className="text-center text-sm text-white/50">
          <div className="text-2xl">🗺️</div>
          The national canvas activates once a Mapbox token is configured.
          <div className="mt-1 text-xs text-white/35">{venues.length.toLocaleString()} venues ready to plot.</div>
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
