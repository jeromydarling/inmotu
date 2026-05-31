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
// Public. Pick the sport you're curious about → how to start, beginner-friendly
// tracks near you, try-it events, and a no-commitment way to get set up.

const CURIOUS_ORDER: SectorId[] = [
  "bmx", "motocross", "karting_sprint", "drag", "autocross", "karting_dirt", "roadrace",
];
const ACCENT: Record<string, string> = {
  motocross: "#22C55E", bmx: "#FF4D14", drag: "#3B82F6", karting_sprint: "#A855F7",
  karting_dirt: "#F59E0B", roadrace: "#FF4D14", autocross: "#94A3B8",
};

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
          we'll show you the easy first step — the welcoming tracks near you, what it costs, and what
          to bring.
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
  const [data, setData] = useState<Awaited<ReturnType<typeof api.startSector>> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.startSector(sector).then(setData).catch(() => setData(null));
  }, [sector]);

  // Commitment-free "get set up": adopt this sector + (if signed in) create a
  // no-number profile so they're ready before they ever race.
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
    lat: v.lat,
    lng: v.lng,
    title: v.name,
    sub: v.starter_note ?? [v.city, v.state].filter(Boolean).join(", "),
    tone: "green",
    href: v.website ?? undefined,
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
                  <li key={b} className="flex items-start gap-2 text-sm text-white/70">
                    <span className="text-flag-green">✓</span> {b}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Words you'll hear</p>
              <dl className="mt-2 space-y-1.5">
                {g.glossary.map((t) => (
                  <div key={t.term} className="text-sm">
                    <dt className="inline font-semibold text-white">{t.term}:</dt>{" "}
                    <dd className="inline text-white/60">{t.def}</dd>
                  </div>
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

      {/* Beginner-friendly tracks near you */}
      <section className="mb-6">
        <h3 className="font-display text-xl font-bold tracking-tight">Welcoming tracks to start at</h3>
        <p className="mt-1 text-sm text-white/55">
          Tracks known for beginner clinics, rentals, or try-it days — the friendly first stops.
        </p>
        {data === null ? (
          <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
        ) : data.venues.length === 0 ? (
          <p className="mt-3 text-sm text-white/45">
            We're still mapping beginner-friendly {s.label.toLowerCase()} tracks. Explore the full{" "}
            <Link to="/map" className="text-ignition-300 hover:underline">national map →</Link>
          </p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <MapView points={points} height={420} />
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {data.venues.map((v) => (
                <div key={v.id} className="rounded-xl border border-white/[0.06] bg-carbon-850 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">{v.name}</span>
                    <span className="shrink-0 text-xs text-white/40">{[v.city, v.state].filter(Boolean).join(", ")}</span>
                  </div>
                  {v.starter_note && <p className="mt-1 text-xs text-white/55">{v.starter_note}</p>}
                  {v.website && (
                    <a href={v.website} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-ignition-300 hover:underline">
                      Visit track site ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Try-it / upcoming events */}
      {data && data.events.length > 0 && (
        <section className="mb-6">
          <h3 className="font-display text-xl font-bold tracking-tight">Events you could go watch (or try)</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.events.map((e) => (
              <Link
                key={e.slug}
                to={`/events/${e.slug}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-carbon-850 p-3 hover:border-white/20"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{e.title}</div>
                  <div className="truncate text-xs text-white/45">
                    {e.track_name ?? ""}{e.track_state ? ` · ${e.track_state}` : ""} · {fmtDate(e.starts_at)}
                  </div>
                </div>
                {e.level === "beginner" && (
                  <span className="shrink-0 rounded-full bg-flag-green/15 px-2 py-0.5 text-[11px] font-semibold text-flag-green">
                    beginner
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Commitment-free get-set-up + crew connector */}
      <section className="panel p-6 text-center">
        <h3 className="font-display text-2xl font-extrabold tracking-tight">Ready to take the first step?</h3>
        <p className="mx-auto mt-2 max-w-lg text-white/60">
          Get set up for {s.label} — no race number, no commitment. Save events, track the venues
          near you, and we'll connect you with a welcoming local crew when you're ready to show up.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button onClick={getSetUp} disabled={busy} className="btn-primary px-6 py-3">
            {busy ? "Setting up…" : user ? `Follow ${s.label} → my paddock` : "Create my free profile"}
          </button>
          <Link to="/frontline" className="btn-ghost px-6 py-3">Meet the community</Link>
        </div>
        <p className="mt-3 text-xs text-white/40">Free forever for the calendar &amp; the cause. No card, no catch.</p>
      </section>
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
