import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { SECTORS, type SectorId } from "@shared/types";
import { Spinner, EmptyState } from "../components/ui";
import { titleCase } from "../lib/format";

const SECTOR_ORDER: SectorId[] = ["motocross", "bmx", "drag", "karting_sprint", "karting_dirt", "roadrace", "autocross"];

// Public racer directory — every family who's opted in, the third leg of the
// data moat. Filter by sector + search; click through to a racer's profile.
export default function Racers() {
  const [racers, setRacers] = useState<Awaited<ReturnType<typeof api.racers>>["racers"]>([]);
  const [stats, setStats] = useState<{ total: number } | null>(null);
  const [sector, setSector] = useState<SectorId | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.racerStats().then((s) => setStats({ total: s.total })).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (sector) params.sector = sector;
    if (q) params.q = q;
    const t = setTimeout(() => {
      api.racers(params).then((r) => setRacers(r.racers)).catch(() => setRacers([])).finally(() => setLoading(false));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [sector, q]);

  const empty = useMemo(() => !loading && racers.length === 0, [loading, racers]);

  return (
    <div className="container-page py-12">
      <header className="mb-6">
        <p className="eyebrow">The Directory</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest">Racers of inmotu.</h1>
        <p className="mt-2 max-w-2xl text-white/55">
          The families who race. Find a racer, see their results, follow their season.
          {stats && stats.total > 0 && <span className="text-white/40"> {stats.total.toLocaleString()} and growing.</span>}
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button onClick={() => setSector("")} className={`chip ${!sector ? "bg-ignition/20 text-ignition-300" : ""}`}>All</button>
        {SECTOR_ORDER.map((id) => (
          <button key={id} onClick={() => setSector(id === sector ? "" : id)} className={`chip ${sector === id ? "bg-ignition/20 text-ignition-300" : ""}`}>
            {SECTORS[id].label}
          </button>
        ))}
        <input className="field ml-auto max-w-[200px]" placeholder="Search a racer…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : empty ? (
        <EmptyState
          title="No public racers here yet"
          hint="Racers are private by default. Families can opt into a public profile from their Pit Board — be the first."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {racers.map((r) => (
            <Link key={r.slug} to={`/racers/${r.slug}`} className="panel flex items-center gap-4 p-5 transition hover:border-white/20">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ignition/15 font-display text-lg font-black text-ignition">
                {r.number || r.name.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-lg font-bold text-white">{r.name}</div>
                <div className="truncate text-xs text-white/45">
                  {r.race_class || titleCase(r.discipline || "")}{r.hometown ? ` · ${r.hometown}` : ""}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {r.discipline && <span className="chip">{titleCase(r.discipline)}</span>}
                  {r.wins > 0 && <span className="chip">{r.wins} wins</span>}
                  {r.result_count > 0 && <span className="chip">{r.result_count} results</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
