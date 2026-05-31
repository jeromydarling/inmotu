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
    const t = setTimeout(() => {
      api
        .events(params)
        .then((r) => setEvents(r.events))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [discipline, level, q, mineOnly]);

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
