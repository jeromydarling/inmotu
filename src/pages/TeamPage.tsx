import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Spinner, Badge } from "../components/ui";
import { AiImage } from "../components/motion";
import { ShareButton } from "../components/ShareButton";
import { fmtDateShort, titleCase } from "../lib/format";
import { useTranslate } from "../state/translation";

type Data = Awaited<ReturnType<typeof api.publicTeamPage>>;

function ytEmbed(url: string): string | null {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export default function TeamPage() {
  const { slug } = useParams();
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    api.publicTeamPage(slug).then(setD).catch(() => setD(null)).finally(() => setLoading(false));
  }, [slug]);

  // Translate the team's own prose (tagline + bio) for Spanish readers.
  const texts = useMemo(() => [d?.page?.tagline ?? "", d?.page?.bio ?? ""], [d]);
  const trvals = useTranslate(texts);
  const tr = useMemo(() => {
    const m = new Map<string, string>();
    texts.forEach((t, i) => m.set(t, trvals[i]));
    return (s: string) => m.get(s) ?? s;
  }, [texts, trvals]);

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Spinner className="h-8 w-8" /></div>;
  if (!d) return (
    <div className="container-page py-24 text-center text-white/50">
      This page isn't available. <Link to="/" className="text-ignition">Go home</Link>
    </div>
  );

  const { page, riders, events, photos, sponsors, ladder, stats } = d;
  const accent = page.accent_color || "#FF4D14";
  const sections = page.sections || {};
  const socials: Record<string, string> = page.socials || {};
  const embed = page.featured_video ? ytEmbed(page.featured_video) : null;

  return (
    <div style={{ ["--accent" as any]: accent }}>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <AiImage slug={page.hero_slug || "paddock"} kenBurns overlay={false} className="absolute inset-0 -z-10 h-full w-full" imgClassName="opacity-50" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-carbon-950 via-carbon-950/70 to-carbon-950/40" />
        <div className="absolute inset-x-0 top-0 -z-10 h-1" style={{ background: accent }} />
        <div className="container-page py-24 sm:py-32">
          {page.discipline && <Badge tone="amber">{titleCase(page.discipline)}</Badge>}
          <h1 className="mt-4 font-display text-5xl font-black tracking-tightest drop-shadow-lg sm:text-6xl">{page.name}</h1>
          {page.tagline && <p className="mt-3 max-w-xl text-lg font-semibold" style={{ color: accent }}>{tr(page.tagline)}</p>}
          {page.hometown && <p className="mt-2 text-sm text-white/50">📍 {page.hometown}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <ShareButton title={page.name} text={page.tagline || `Follow ${page.name} on inmotu`} />
            <SocialRow socials={socials} accent={accent} />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      {sections.stats && stats && (
        <div className="border-y border-white/[0.06] bg-carbon-900/40">
          <div className="container-page grid grid-cols-3 gap-6 py-8 text-center">
            <Stat n={stats.riders} label="Riders" accent={accent} />
            <Stat n={stats.races} label="Races entered" accent={accent} />
            <Stat n={stats.advancements} label="Advancements" accent={accent} />
          </div>
        </div>
      )}

      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1.5fr_0.5fr]">
        <div className="space-y-12">
          {page.bio && (
            <section>
              <h2 className="mb-2 font-display text-xl font-bold">About</h2>
              <p className="whitespace-pre-wrap text-white/65">{tr(page.bio)}</p>
            </section>
          )}

          {sections.video && embed && (
            <section>
              <h2 className="mb-3 font-display text-xl font-bold">Featured</h2>
              <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10">
                <iframe src={embed} title="Featured video" className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            </section>
          )}

          {sections.riders && riders && riders.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-bold">The riders</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {riders.map((r: any, i: number) => (
                  <div key={i} className="panel flex items-center gap-3 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl font-display text-lg font-black" style={{ background: `${accent}22`, color: accent }}>
                      {r.number || r.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-display font-bold text-white">{r.name}</div>
                      <div className="text-xs text-white/45">{r.race_class || titleCase(r.discipline || "")}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sections.ladder && ladder && ladder.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-bold">Chasing the championship</h2>
              <div className="space-y-2">
                {ladder.map((l: any, i: number) => (
                  <div key={i} className="panel flex items-center justify-between p-3">
                    <div><span className="font-semibold text-white">{l.rider}</span> <span className="text-sm text-white/45">· {l.stage}</span></div>
                    <div className="flex items-center gap-2">
                      {l.result_pos != null && <Badge tone="muted">P{l.result_pos}</Badge>}
                      {l.advanced ? <Badge tone="green">Advanced ✓</Badge> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sections.events && events && events.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-bold">Where to find us</h2>
              <div className="space-y-2">
                {events.map((e: any) => {
                  const dt = fmtDateShort(e.starts_at);
                  return (
                    <Link key={e.slug} to={`/events/${e.slug}`} className="panel flex items-center gap-4 p-3 transition hover:border-white/20">
                      <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-white/10 bg-carbon-900 py-1">
                        <span className="text-[10px] font-bold uppercase" style={{ color: accent }}>{dt.mon}</span>
                        <span className="font-display text-lg font-extrabold leading-none">{dt.day}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{e.title}</div>
                        <div className="truncate text-xs text-white/45">{e.track_name}{e.state ? `, ${e.state}` : ""}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {sections.photos && photos && photos.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-bold">Gallery</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p: any) => (
                  <figure key={p.id} className="panel group relative overflow-hidden">
                    <img src={`/api/photos/${p.id}/public-raw`} alt={p.caption || ""} loading="lazy" className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" />
                    {p.caption && <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-carbon-950 to-transparent px-2 py-1.5 text-xs text-white/80">{p.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}

          {sections.sponsors && sponsors && sponsors.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-bold">Our partners</h2>
              <div className="flex flex-wrap gap-2">
                {sponsors.map((s: any, i: number) => (
                  <span key={i} className="rounded-xl border border-white/10 bg-carbon-850 px-4 py-2 text-sm font-semibold text-white/80">
                    {s.name}{s.tier === "title" ? " ★" : ""}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-6 text-center">
            <p className="text-sm text-white/60">Built with</p>
            <Link to="/" className="font-display text-2xl font-extrabold">in<span style={{ color: accent }}>motu</span></Link>
            <p className="mt-2 text-xs text-white/40">The home for grassroots motorsports families.</p>
            <Link to="/register" className="btn-primary mt-4 w-full">Start your own →</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent: string }) {
  return (
    <div>
      <div className="font-display text-3xl font-extrabold sm:text-4xl" style={{ color: accent }}>{n ?? 0}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-white/45">{label}</div>
    </div>
  );
}

const SOCIAL_ICON: Record<string, string> = {
  instagram: "Instagram", x: "X", youtube: "YouTube", facebook: "Facebook", tiktok: "TikTok", website: "Website",
};
function SocialRow({ socials, accent }: { socials: Record<string, string>; accent: string }) {
  const entries = Object.entries(socials).filter(([, v]) => v);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([k, url]) => (
        <a key={k} href={url} target="_blank" rel="noreferrer"
          className="rounded-full border px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:text-white"
          style={{ borderColor: `${accent}55` }}>
          {SOCIAL_ICON[k] || k}
        </a>
      ))}
    </div>
  );
}
