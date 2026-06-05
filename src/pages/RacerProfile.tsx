import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Badge, Spinner } from "../components/ui";
import { ShareButton } from "../components/ShareButton";
import { fmtDate, titleCase } from "../lib/format";
import { useTranslate } from "../state/translation";

// Public racer profile — the opt-in racing identity: stats, results, photos.
// No private data (no email/birthdate/address). Mirrors the track/team detail
// pattern; SEO meta is injected server-side at /racers/:slug.
export default function RacerProfile() {
  const { slug } = useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.racer>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    api.racer(slug).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [slug]);

  // Translate the racer's bio for Spanish readers (hook before early returns).
  const bio = data?.racer?.bio ?? "";
  const [trBio] = useTranslate(useMemo(() => [bio], [bio]));

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Spinner className="h-8 w-8" /></div>;
  if (!data)
    return (
      <div className="container-page py-24 text-center text-white/50">
        Racer not found. <Link to="/racers" className="text-ignition">Back to the directory</Link>
      </div>
    );

  const { racer, results, photos, stats } = data;

  return (
    <div className="container-page py-12">
      <Link to="/racers" className="text-sm text-white/40 hover:text-white">← Racer directory</Link>

      {/* Hero */}
      <div className="panel mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-ignition/15 font-display text-3xl font-black text-ignition">
            {racer.number || racer.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap gap-2">
              {racer.discipline && <Badge tone="amber">{titleCase(racer.discipline)}</Badge>}
              {racer.race_class && <Badge>{racer.race_class}</Badge>}
              {racer.skill_level && <Badge tone="muted">{titleCase(racer.skill_level)}</Badge>}
            </div>
            <h1 className="font-display text-4xl font-extrabold tracking-tightest">{racer.name}</h1>
            {racer.hometown && <p className="mt-1 text-white/55">{racer.hometown}</p>}
          </div>
          <ShareButton title={racer.name} text={`${racer.name} on inmotu`} className="btn-ghost btn-sm" label="Share" />
        </div>

        {/* Stat bar */}
        <div className="grid grid-cols-4 gap-px border-t border-white/[0.06] bg-white/[0.04]">
          <Stat label="Events" value={stats.events} />
          <Stat label="Results" value={stats.results} />
          <Stat label="Podiums" value={stats.podiums} />
          <Stat label="Wins" value={Math.max(stats.wins, racer.wins ?? 0)} />
        </div>
      </div>

      {racer.bio && <p className="mt-6 max-w-2xl text-white/70">{trBio}</p>}

      {/* Results */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold tracking-tight">Recent results</h2>
        {results.length === 0 ? (
          <p className="mt-2 text-sm text-white/45">No timed results yet — they'll appear here as this racer competes.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {results.map((r, i) => (
              <Link
                key={i}
                to={`/events/${r.event_slug}`}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-carbon-850 p-3 hover:border-white/20"
              >
                <span className={`font-display text-xl font-extrabold ${r.position === 1 ? "text-amber" : r.position && r.position <= 3 ? "text-flag-green" : "text-white/50"}`}>
                  P{r.position ?? "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{r.event_title}</div>
                  <div className="truncate text-xs text-white/45">
                    {r.session_name}{r.race_class ? ` · ${r.race_class}` : ""} · {fmtDate(r.event_at)}
                  </div>
                </div>
                {r.best_lap && <span className="shrink-0 font-mono text-xs text-white/40">{r.best_lap}</span>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Photos */}
      {photos.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold tracking-tight">Photos</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <figure key={p.id} className="overflow-hidden rounded-xl border border-white/[0.06] bg-carbon-850">
                <img src={`/api/photos/${p.id}/public-raw`} alt={p.caption ?? racer.name} loading="lazy" className="aspect-square w-full object-cover" />
                {p.caption && <figcaption className="truncate px-2 py-1 text-[11px] text-white/45">{p.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-carbon-900 p-4 text-center">
      <div className="font-display text-2xl font-extrabold text-white">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
    </div>
  );
}
