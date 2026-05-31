import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { MapView, type MapPoint } from "../components/MapView";
import { Spinner } from "../components/ui";
import { fmtDate, titleCase } from "../lib/format";

const DISCIPLINES = ["motocross", "autocross", "road-race", "karting", "short-track", "enduro", "rally"];

type Ev = {
  slug: string;
  title: string;
  discipline?: string;
  region?: string;
  starts_at: number;
  track_name?: string;
  track_lat?: number;
  track_lng?: number;
  live?: number;
};

// The Competition Map — every upcoming grassroots event, plotted. Live events
// (timing in progress) glow green. Public; the geographic sibling of The Grid.
export default function CompetitionMap() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [discipline, setDiscipline] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const params: Record<string, string> = {};
    if (discipline) params.discipline = discipline;
    if (q) params.q = q;
    setLoading(true);
    api
      .events(params)
      .then((r) => setEvents(r.events as unknown as Ev[]))
      .finally(() => setLoading(false));
  }, [discipline, q]);

  const located = useMemo(
    () => events.filter((e) => e.track_lat != null && e.track_lng != null),
    [events],
  );
  const liveCount = located.filter((e) => e.live).length;

  const points: MapPoint[] = located.map((e) => ({
    lat: e.track_lat!,
    lng: e.track_lng!,
    title: e.title,
    sub: `${e.track_name ?? ""}${e.discipline ? ` · ${titleCase(e.discipline)}` : ""} · ${fmtDate(e.starts_at)}`,
    tone: e.live ? "green" : "ignition",
    pulse: !!e.live,
    href: `/events/${e.slug}`,
  }));

  return (
    <div className="container-page py-12">
      <header className="mb-6">
        <p className="eyebrow">The Competition Map</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest">
          Where the racing is.
        </h1>
        <p className="mt-2 max-w-2xl text-white/55">
          Every grassroots event near you, on one map — motocross to road race. Pins glow{" "}
          <span className="text-flag-green">green</span> when timing is live.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ignition" /> Upcoming
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 animate-pulse-live rounded-full bg-flag-green" /> Live now
            {liveCount > 0 && <span className="text-white/40">({liveCount})</span>}
          </span>
          <Link to="/grid" className="ml-auto text-ignition-300 hover:underline">
            Switch to list view →
          </Link>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="field max-w-xs"
          placeholder="Search events or tracks"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field max-w-[12rem]" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
          <option value="">All disciplines</option>
          {DISCIPLINES.map((d) => (
            <option key={d} value={d}>
              {titleCase(d)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <MapView points={points} height={560} />
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-white/40">
              {located.length} event{located.length === 1 ? "" : "s"} on the map
            </p>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {[...located]
                .sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || a.starts_at - b.starts_at)
                .map((e) => (
                  <Link
                    key={e.slug}
                    to={`/events/${e.slug}`}
                    className="block rounded-xl border border-white/[0.06] bg-carbon-850 p-3 hover:border-white/20"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-white">{e.title}</span>
                      {e.live ? (
                        <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-flag-green">
                          <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-flag-green" /> LIVE
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-white/45">
                      {e.track_name} · {e.discipline ? titleCase(e.discipline) : "—"} · {fmtDate(e.starts_at)}
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
