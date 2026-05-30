import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Badge, EmptyState, Spinner } from "../components/ui";
import { titleCase } from "../lib/format";

export default function Standings() {
  const [series, setSeries] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.seriesList().then((r) => {
      setSeries(r.series);
      setActive(r.series[0]?.slug ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="container-page py-20"><Spinner className="mx-auto h-8 w-8" /></div>;

  return (
    <div className="container-page py-12">
      <header className="mb-8">
        <p className="eyebrow">Series standings</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest">Who's on top.</h1>
        <p className="mt-2 max-w-2xl text-white/55">
          Season-long points across every round, auto-calculated from results. No more guessing
          where you sit in the championship.
        </p>
      </header>

      {series.length === 0 ? (
        <EmptyState title="No series yet" hint="Operators can create a points series from the Tower." />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {series.map((s) => (
              <button
                key={s.slug}
                onClick={() => setActive(s.slug)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${active === s.slug ? "border-ignition/50 bg-ignition/15 text-ignition-300" : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"}`}
              >
                {s.name} <span className="text-white/30">· {s.rounds} rounds</span>
              </button>
            ))}
          </div>
          {active && <StandingsTable key={active} slug={active} />}
        </>
      )}
    </div>
  );
}

function StandingsTable({ slug }: { slug: string }) {
  const [data, setData] = useState<{ series: any; standings: any[] } | null>(null);
  useEffect(() => {
    api.standings(slug).then(setData).catch(() => setData(null));
  }, [slug]);
  if (!data) return <Spinner className="mx-auto h-6 w-6" />;
  if (data.standings.length === 0) return <EmptyState title="No results posted yet" hint="Standings appear once the operator posts round results." />;

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <span className="font-display font-bold text-white">{data.series.name}</span>
        <Badge tone="muted">{data.series.season} {titleCase(data.series.discipline || "")}</Badge>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {data.standings.map((row, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-display text-sm font-extrabold ${i === 0 ? "bg-amber/20 text-amber" : i < 3 ? "bg-white/[0.06] text-white" : "text-white/40"}`}>
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-white">{row.competitor}</div>
              {row.race_class && <div className="text-xs text-white/40">{row.race_class}</div>}
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-extrabold text-ignition">{row.points}</div>
              <div className="text-[11px] text-white/40">{row.rounds} rounds · best P{row.best}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
