import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type VenuePin } from "../api/client";
import { VenueMap, CATEGORY_META } from "../components/VenueMap";
import { titleCase } from "../lib/format";

const CATEGORIES = ["road", "oval", "motocross", "drag", "karting"] as const;

// The National Canvas — every motorsports venue in America on one map, with the
// live event + battle layers on top. The flagship public surface.
export default function CompetitionMap() {
  const [venues, setVenues] = useState<VenuePin[]>([]);
  const [stats, setStats] = useState<{ total: number; states: number; byCategory: { category: string; n: number }[] } | null>(null);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.venues({ limit: "10000" }), api.venueStats()])
      .then(([v, s]) => {
        setVenues(v.venues);
        setStats(s);
      })
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    return venues.filter((v) => {
      if (active.size && !active.has(v.category)) return false;
      if (q && !v.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [venues, active, q]);

  function toggle(cat: string) {
    setActive((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  async function openVenue(id: string) {
    setSelected({ loading: true });
    try {
      const r = await api.venue(id);
      setSelected(r.venue);
    } catch {
      setSelected(null);
    }
  }

  const catCount = (c: string) => stats?.byCategory.find((x) => x.category === c)?.n ?? 0;

  return (
    <div className="relative">
      {/* Header band */}
      <div className="container-page pt-12 pb-5">
        <p className="eyebrow">The National Canvas</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest sm:text-5xl">
          Every track in America.
        </h1>
        <p className="mt-2 max-w-2xl text-white/55">
          The most complete map of grassroots motorsports anywhere — ovals, motocross, road
          courses, drag strips, and karting. Events, live timing, and the tracks we're fighting for,
          all on one canvas.
        </p>

        {/* Live stat HUD */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Stat value={stats?.total} label="venues mapped" tone="text-ignition" />
          <Stat value={stats?.states} label="states" tone="text-white" />
          <Stat value={shown.length} label="shown" tone="text-flag-green" />
          <Link to="/grid" className="ml-auto text-sm text-ignition-300 hover:underline">
            Switch to event list →
          </Link>
        </div>

        {/* Category filter chips + search */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => {
            const on = active.has(c);
            const meta = CATEGORY_META[c];
            return (
              <button
                key={c}
                onClick={() => toggle(c)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  on || active.size === 0
                    ? "border-white/20 bg-white/[0.06] text-white"
                    : "border-white/[0.06] text-white/40 hover:text-white/70"
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
                {meta.label}
                <span className="text-xs text-white/35">{catCount(c).toLocaleString()}</span>
              </button>
            );
          })}
          {active.size > 0 && (
            <button onClick={() => setActive(new Set())} className="text-xs text-white/40 hover:text-white">
              clear
            </button>
          )}
          <input
            className="field ml-auto max-w-[200px]"
            placeholder="Search a track…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Full-bleed map */}
      <div className="container-page pb-12">
        <div className="relative">
          <VenueMap
            venues={shown}
            height="min(72vh, 720px)"
            onSelect={openVenue}
            intro={!loading}
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-carbon-950/60 backdrop-blur-sm">
              <div className="animate-pulse text-sm text-white/60">Loading the canvas…</div>
            </div>
          )}

          {/* Venue detail drawer */}
          {selected && (
            <div className="absolute right-4 top-4 z-10 w-[300px] animate-fade-up rounded-2xl border border-white/10 bg-carbon-900/95 p-5 shadow-glow backdrop-blur">
              <button
                onClick={() => setSelected(null)}
                className="absolute right-3 top-3 text-white/30 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
              {selected.loading ? (
                <div className="py-8 text-center text-sm text-white/40">Loading…</div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: (CATEGORY_META[selected.category] ?? CATEGORY_META.circuit).color }}
                    />
                    <span className="text-xs uppercase tracking-wide text-white/45">
                      {(CATEGORY_META[selected.category] ?? CATEGORY_META.circuit).label}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-xl font-bold text-white">{selected.name}</h3>
                  <p className="text-sm text-white/50">
                    {[selected.city, selected.state].filter(Boolean).join(", ")}
                  </p>
                  {selected.surface && (
                    <span className="mt-2 inline-block rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-white/55">
                      {titleCase(selected.surface)}
                    </span>
                  )}
                  {selected.status === "endangered" && (
                    <div className="mt-3 rounded-lg border border-flag-red/30 bg-flag-red/10 px-3 py-2 text-xs font-semibold text-flag-red">
                      ● This track is under threat — see The Frontline
                    </div>
                  )}
                  {selected.website && (
                    <a
                      href={selected.website}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost btn-sm mt-4 w-full"
                    >
                      Visit track site ↗
                    </a>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-white/30">
          Tap a cluster to zoom in · tap a track for detail. Coverage grows every day.
        </p>
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number | undefined; label: string; tone: string }) {
  return (
    <div className="panel px-4 py-2.5">
      <span className={`font-display text-xl font-extrabold ${tone}`}>
        {value === undefined ? "—" : value.toLocaleString()}
      </span>
      <span className="ml-2 text-sm text-white/50">{label}</span>
    </div>
  );
}
