import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { SECTORS, type SectorId } from "@shared/types";
import { STARTER_GUIDES } from "../lib/starterGuides";
import { MapView, type MapPoint } from "../components/MapView";
import { Spinner } from "../components/ui";
import { fmtDate } from "../lib/format";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

// "Start Here" — the on-ramp that turns a curious family into a racing family.
// Pick the sport you're curious about + your state → how to start, beginner
// tracks, try-it events, AND local crews to connect with (discovered live).

const CURIOUS_ORDER: SectorId[] = [
  "bmx", "motocross", "karting_sprint", "drag", "autocross", "karting_dirt", "roadrace",
];
const ACCENT: Record<string, string> = {
  motocross: "#22C55E", bmx: "#FF4D14", drag: "#3B82F6", karting_sprint: "#A855F7",
  karting_dirt: "#F59E0B", roadrace: "#FF4D14", autocross: "#94A3B8",
};
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

export default function Start() {
  const [picked, setPicked] = useState<SectorId | null>(null);

  return (
    <div className="container-page py-12">
      <header className="mb-8 text-center">
        <p className="eyebrow">Start Here</p>
        <h1 className="mx-auto mt-2 max-w-3xl font-display text-4xl font-extrabold tracking-tightest sm:text-5xl">
          Thinking about racing? You're already part of it.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-white/60">
          You don't need a race car, a number, or any experience. Pick what you're curious about and
          we'll show you the easy first step — the welcoming tracks near you, the local crews to call,
          what it costs, and what to bring.
        </p>
      </header>

      {!picked ? (
        <div>
          <p className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-white/40">
            What are you curious about?
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CURIOUS_ORDER.map((id) => {
              const s = SECTORS[id];
              const g = STARTER_GUIDES[id];
              return (
                <button
                  key={id}
                  onClick={() => setPicked(id)}
                  className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-carbon-850 p-5 text-left transition hover:border-white/25"
                >
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: ACCENT[id] }} />
                  <div className="pl-2">
                    <div className="font-display text-xl font-bold text-white">{s.label}</div>
                    <p className="mt-1 text-sm text-white/55">{g?.hook ?? s.tagline}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-6 text-center text-sm text-white/45">
            Already racing?{" "}
            <Link to="/register" className="text-ignition-300 hover:underline">Set up your paddock →</Link>
          </p>
        </div>
      ) : (
        <SectorStart sector={picked} onBack={() => setPicked(null)} />
      )}
    </div>
  );
}

function SectorStart({ sector, onBack }: { sector: SectorId; onBack: () => void }) {
  const g = STARTER_GUIDES[sector];
  const s = SECTORS[sector];
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const initialState = (user?.home_region && /^[A-Z]{2}$/.test(user.home_region) ? user.home_region : "");
  const [stateCode, setStateCode] = useState(initialState);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.startSector>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  function load(st: string) {
    setLoading(true);
    api.startSector(sector, st || undefined).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }
  useEffect(() => { load(initialState); /* eslint-disable-next-line */ }, [sector]);

  // Discovery runs in the background; when a slice is pending, re-fetch once
  // after a short delay to pick up the freshly-found local crews + events.
  useEffect(() => {
    if (!data?.discovery.pending || !stateCode) return;
    const t = setTimeout(() => load(stateCode), 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [data?.discovery.pending, stateCode]);

  async function getSetUp() {
    if (!user) {
      nav("/register", { state: { from: "/start", sector } });
      return;
    }
    setBusy(true);
    try {
      const sectors = Array.from(new Set([...(user.sectors ?? []), sector]));
      await api.setSectors(sectors);
      await refresh();
      toast.success(`You're set up for ${s.label}. Welcome to the paddock.`);
      nav("/app");
    } catch {
      toast.error("Couldn't set that up. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const points: MapPoint[] = (data?.venues ?? []).map((v) => ({
    lat: v.lat, lng: v.lng, title: v.name,
    sub: v.starter_note ?? [v.city, v.state].filter(Boolean).join(", "),
    tone: "green", href: v.website ?? undefined,
  }));

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-white/40 hover:text-white">← Pick a different sport</button>

      {/* Guide */}
      {g && (
        <div className="panel mb-6 p-6">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: ACCENT[sector] }} />
            <h2 className="font-display text-2xl font-extrabold tracking-tight">{s.label}</h2>
          </div>
          <p className="mt-2 text-lg text-white/75">{g.hook}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Block title="Who it's for">{g.whoFor}</Block>
            <Block title="Your easiest first step">{g.firstStep}</Block>
            <Block title="What it costs to try">{g.tryCost}</Block>
            <Block title="The youngest can start in">{g.youngest}</Block>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Bring the first day</p>
              <ul className="mt-2 space-y-1">
                {g.bring.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-white/70"><span className="text-flag-green">✓</span> {b}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Words you'll hear</p>
              <dl className="mt-2 space-y-1.5">
                {g.glossary.map((t) => (
                  <div key={t.term} className="text-sm"><dt className="inline font-semibold text-white">{t.term}:</dt>{" "}<dd className="inline text-white/60">{t.def}</dd></div>
                ))}
              </dl>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-ignition/20 bg-ignition/[0.06] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ignition-300">What your first day feels like</p>
            <p className="mt-1 text-sm text-white/75">{g.firstDay}</p>
          </div>
        </div>
      )}

      {/* State picker — drives local discovery */}
      <div className="panel mb-6 flex flex-wrap items-end gap-3 p-5">
        <div>
          <label className="label">Find {s.label} near you</label>
          <select
            className="field w-44"
            value={stateCode}
            onChange={(e) => { setStateCode(e.target.value); load(e.target.value); }}
          >
            <option value="">Choose your state…</option>
            {US_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
        <p className="flex-1 text-xs text-white/40">
          Pick your state and we'll pull the welcoming tracks, beginner events, and local crews near
          you — including clubs you can actually call.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
      ) : (
        <>
          {/* Beginner-friendly tracks */}
          <section className="mb-6">
            <h3 className="font-display text-xl font-bold tracking-tight">Welcoming tracks to start at</h3>
            <p className="mt-1 text-sm text-white/55">Tracks known for beginner clinics, rentals, or try-it days.</p>
            {(data?.venues.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-white/45">
                {stateCode
                  ? `Still mapping beginner ${s.label.toLowerCase()} tracks in ${stateCode}. `
                  : "Pick your state above to see tracks near you. "}
                <Link to="/map" className="text-ignition-300 hover:underline">Explore the national map →</Link>
              </p>
            ) : (
              <div className="mt-4 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                <MapView points={points} height={400} />
                <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
                  {data!.venues.map((v) => (
                    <div key={v.id} className="rounded-xl border border-white/[0.06] bg-carbon-850 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">{v.name}</span>
                        <span className="shrink-0 text-xs text-white/40">{[v.city, v.state].filter(Boolean).join(", ")}</span>
                      </div>
                      {v.starter_note && <p className="mt-1 text-xs text-white/55">{v.starter_note}</p>}
                      {v.website && <a href={v.website} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-ignition-300 hover:underline">Visit track site ↗</a>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Local crews to connect with */}
          {stateCode && (
            <section className="mb-6">
              <h3 className="font-display text-xl font-bold tracking-tight">Local crews to connect with</h3>
              <p className="mt-1 text-sm text-white/55">
                Clubs, teams, and community groups near you. AI-found from public sources — tap to
                verify before you reach out.
              </p>
              {data?.discovery.configured === false ? (
                <p className="mt-3 text-sm text-white/45">Local crew discovery activates once the research key is configured.</p>
              ) : (data?.crews.length ?? 0) === 0 ? (
                <p className="mt-3 text-sm text-white/45">
                  {data?.discovery.pending
                    ? `Scanning ${stateCode} for local crews right now — hang tight, they'll appear in a moment.`
                    : `No crews mapped here yet — we're reaching out into ${stateCode}. Check back soon.`}
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {data!.crews.map((cr) => (
                    <div key={cr.id} className="rounded-xl border border-white/[0.06] bg-carbon-850 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-white">{cr.name}</span>
                            {cr.beginner_friendly === 1 && (
                              <span className="shrink-0 rounded-full bg-flag-green/15 px-1.5 py-0.5 text-[10px] font-semibold text-flag-green">welcomes newcomers</span>
                            )}
                          </div>
                          <div className="text-xs text-white/40 capitalize">{cr.kind.replace("_", " ")}{cr.city ? ` · ${cr.city}, ${cr.state}` : ""}</div>
                        </div>
                        {cr.verified === 1 ? (
                          <span className="shrink-0 text-[10px] font-semibold text-flag-green">✓ verified</span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber" title="AI-found — confirm via the source link before relying on contact details">unverified</span>
                        )}
                      </div>
                      {cr.blurb && <p className="mt-1.5 text-xs text-white/60">{cr.blurb}</p>}
                      {cr.meets && <p className="mt-1 text-[11px] text-white/40">{cr.meets}</p>}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {cr.website && <a href={cr.website} target="_blank" rel="noreferrer" className="text-ignition-300 hover:underline">Website ↗</a>}
                        {cr.facebook && <a href={cr.facebook} target="_blank" rel="noreferrer" className="text-ignition-300 hover:underline">Facebook ↗</a>}
                        {cr.email && <a href={`mailto:${cr.email}`} className="text-white/60 hover:text-white">Email</a>}
                        {cr.phone && <a href={`tel:${cr.phone}`} className="text-white/60 hover:text-white">Call</a>}
                      </div>
                      {cr.citations.length > 0 && (
                        <div className="mt-2 border-t border-white/[0.05] pt-2 text-[10px] text-white/35">
                          source: {cr.citations.slice(0, 2).map((c, i) => (
                            <a key={i} href={c.url} target="_blank" rel="noreferrer" className="text-white/45 hover:underline">{hostname(c.url)}{i === 0 && cr.citations.length > 1 ? ", " : ""}</a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Try-it / upcoming events */}
          {(data?.events.length ?? 0) > 0 && (
            <section className="mb-6">
              <h3 className="font-display text-xl font-bold tracking-tight">Events you could go watch (or try)</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {data!.events.map((e) => (
                  <Link key={e.slug} to={`/events/${e.slug}`} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-carbon-850 p-3 hover:border-white/20">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">{e.title}</div>
                      <div className="truncate text-xs text-white/45">
                        {e.track_name ?? ""}{e.track_state ? ` · ${e.track_state}` : ""} · {fmtDate(e.starts_at)}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {e.level === "beginner" && <span className="rounded-full bg-flag-green/15 px-2 py-0.5 text-[11px] font-semibold text-flag-green">beginner</span>}
                      {e.needs_review === 1 && <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold text-amber" title="AI-found — verify the date/details">unverified</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Commitment-free get-set-up */}
          <section className="panel p-6 text-center">
            <h3 className="font-display text-2xl font-extrabold tracking-tight">Ready to take the first step?</h3>
            <p className="mx-auto mt-2 max-w-lg text-white/60">
              Get set up for {s.label} — no race number, no commitment. Save events, track the venues
              near you, and connect with a welcoming local crew when you're ready to show up.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button onClick={getSetUp} disabled={busy} className="btn-primary px-6 py-3">
                {busy ? "Setting up…" : user ? `Follow ${s.label} → my paddock` : "Create my free profile"}
              </button>
              <Link to="/frontline" className="btn-ghost px-6 py-3">Meet the community</Link>
            </div>
            <p className="mt-3 text-xs text-white/40">Free forever for the calendar &amp; the cause. No card, no catch.</p>
          </section>
        </>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-carbon-850 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{title}</p>
      <p className="mt-1 text-sm text-white/75">{children}</p>
    </div>
  );
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "source"; }
}
