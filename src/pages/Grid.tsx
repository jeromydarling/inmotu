import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { EventItem } from "@shared/types";
import { EventCard } from "../components/EventCard";
import { EmptyState, Spinner } from "../components/ui";
import { useAuth } from "../state/auth";
import { titleCase } from "../lib/format";

export default function Grid() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [disciplines, setDisciplines] = useState<{ slug: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [discipline, setDiscipline] = useState("");
  const [level, setLevel] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.reference().then((r) => setDisciplines(r.disciplines)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (discipline) params.discipline = discipline;
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
  }, [discipline, level, q]);

  async function toggleSave(e: EventItem) {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    // optimistic
    setEvents((prev) =>
      prev.map((x) => (x.id === e.id ? { ...x, saved: !x.saved } : x)),
    );
    try {
      await api.toggleSave(e.id);
    } catch {
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
          Filter by discipline and level. Save events to your calendar and get deadline alerts
          before registration closes.
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
          <FilterPill active={!discipline} onClick={() => setDiscipline("")}>
            All disciplines
          </FilterPill>
          {disciplines.slice(0, 6).map((d) => (
            <FilterPill
              key={d.slug}
              active={discipline === d.slug}
              onClick={() => setDiscipline(discipline === d.slug ? "" : d.slug)}
            >
              {d.label}
            </FilterPill>
          ))}
        </div>
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        <span className="self-center text-xs font-semibold uppercase tracking-wider text-white/35">
          Level:
        </span>
        <FilterPill active={!level} onClick={() => setLevel("")}>
          Any
        </FilterPill>
        {levels.map((l) => (
          <FilterPill key={l} active={level === l} onClick={() => setLevel(level === l ? "" : l)}>
            {titleCase(l)}
          </FilterPill>
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

function FilterPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-ignition/50 bg-ignition/15 text-ignition-300"
          : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
