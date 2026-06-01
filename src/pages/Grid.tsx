import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { EventItem } from "@shared/types";
import { EventCard } from "../components/EventCard";
import { EmptyState, Spinner, Pill } from "../components/ui";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import { titleCase } from "../lib/format";
import { sectorDisciplines } from "../lib/sector";

export default function Grid() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [disciplines, setDisciplines] = useState<{ slug: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [discipline, setDiscipline] = useState("");
  const [level, setLevel] = useState("");
  const [q, setQ] = useState("");
  // Scope to the user's sectors by default when they have any.
  const mySectorDisc = sectorDisciplines(user?.sectors);
  const [mineOnly, setMineOnly] = useState(mySectorDisc.length > 0);
  // "Near me" — browser geolocation + radius.
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(100);
  const [geoBusy, setGeoBusy] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device.");
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        api.trackEvent("near_me");
        setGeoBusy(false);
      },
      () => {
        toast.error("Couldn't get your location. Check permissions?");
        setGeoBusy(false);
      },
      { timeout: 8000 },
    );
  }

  useEffect(() => {
    api.reference().then((r) => setDisciplines(r.disciplines)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (discipline) params.discipline = discipline;
    else if (mineOnly && mySectorDisc.length) params.disciplines = mySectorDisc.join(",");
    if (level) params.level = level;
    if (q) params.q = q;
    if (geo) {
      params.lat = String(geo.lat);
      params.lng = String(geo.lng);
      params.radius = String(radius);
    }
    const t = setTimeout(() => {
      api
        .events(params)
        .then((r) => setEvents(r.events))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [discipline, level, q, mineOnly, geo, radius]);

  async function toggleSave(e: EventItem) {
    if (!user) {
      nav("/login", { state: { from: "/grid" } });
      return;
    }
    // optimistic
    setEvents((prev) =>
      prev.map((x) => (x.id === e.id ? { ...x, saved: !x.saved } : x)),
    );
    try {
      await api.toggleSave(e.id);
    } catch {
      toast.error("Couldn't update your calendar. Try again.");
      setEvents((prev) =>
        prev.map((x) => (x.id === e.id ? { ...x, saved: e.saved } : x)),
      );
    }
  }

  const levels = ["beginner", "club", "qualifier", "regional", "national"];

  const grouped = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of events) {
      const d = new Date(e.starts_at * 1000);
      const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      (map.get(key) ?? map.set(key, []).get(key)!).push(e);
    }
    return [...map.entries()];
  }, [events]);

  return (
    <div className="container-page py-12">
      <header className="mb-8">
        <p className="eyebrow">Module 01 · The Grid</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest">
          Every race in America. One calendar.
        </h1>
        <p className="mt-2 max-w-2xl text-white/55">
          Find where your people are racing next. Filter by discipline and level, save events to
          your calendar, and get a nudge before registration closes — so you never miss the
          weekend that matters.
        </p>
      </header>

      {/* Near me */}
      <div className="panel mb-3 flex flex-wrap items-center gap-3 p-4">
        {geo ? (
          <>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-flag-green">
              <span className="h-2 w-2 rounded-full bg-flag-green" /> Showing events near you
            </span>
            <select className="field max-w-[9rem]" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              {[25, 50, 100, 200, 500].map((r) => <option key={r} value={r}>within {r} mi</option>)}
            </select>
            <button className="text-xs text-white/45 hover:text-white" onClick={() => setGeo(null)}>clear</button>
          </>
        ) : (
          <button className="btn-primary btn-sm" disabled={geoBusy} onClick={useMyLocation}>
            {geoBusy ? "Locating…" : "📍 Show races near me"}
          </button>
        )}
        <p className="ml-auto text-xs text-white/40">Find what's running this weekend, close to home.</p>
      </div>

      {/* Filters */}
      <div className="panel mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          className="field sm:max-w-xs"
          placeholder="Search events or tracks…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {mySectorDisc.length > 0 && (
            <Pill
              active={mineOnly && !discipline}
              onClick={() => {
                setMineOnly((v) => !v);
                setDiscipline("");
              }}
            >
              ★ My sectors
            </Pill>
          )}
          <Pill active={!discipline && !mineOnly} onClick={() => { setDiscipline(""); setMineOnly(false); }}>
            All disciplines
          </Pill>
          {disciplines.slice(0, 6).map((d) => (
            <Pill
              key={d.slug}
              active={discipline === d.slug}
              onClick={() => {
                setMineOnly(false);
                setDiscipline(discipline === d.slug ? "" : d.slug);
              }}
            >
              {d.label}
            </Pill>
          ))}
        </div>
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        <span className="self-center text-xs font-semibold uppercase tracking-wider text-white/35">
          Level:
        </span>
        <Pill active={!level} onClick={() => setLevel("")}>
          Any
        </Pill>
        {levels.map((l) => (
          <Pill key={l} active={level === l} onClick={() => setLevel(level === l ? "" : l)}>
            {titleCase(l)}
          </Pill>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState title="No events match your filters" hint="Try clearing a filter or broadening your search." />
      ) : (
        <div className="space-y-10">
          {grouped.map(([month, items]) => (
            <div key={month}>
              <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-white/40">
                {month}
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {items.map((e) => (
                  <EventCard key={e.id} e={e} onSave={toggleSave} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
