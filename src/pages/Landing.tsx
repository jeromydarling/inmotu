import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type VenuePin } from "../api/client";
import { Badge } from "../components/ui";
import { VenueMap } from "../components/VenueMap";
import { Reveal, CountUp, Marquee, AiImage, SpeedLines } from "../components/motion";
import {
  BrowserFrame,
  ShotGrid,
  ShotStint,
  ShotFrontline,
  ShotTower,
  ShotBudget,
} from "../components/showcase";

const modules = [
  {
    tag: "The Grid",
    title: "Every race. One calendar.",
    body: "The first unified feed of every grassroots event near you — motocross, autocross, road race, endurance, short track. Filtered to your disciplines and class, with registration deadlines front and center so you never miss the Monday cutoff.",
    accent: "ignition",
  },
  {
    tag: "The Pit Board",
    title: "Your whole family, in one place.",
    body: "Every rider in the family, their schedules, maintenance logs, and the real season budget — organized, shared, and ready before the gate drops.",
    accent: "amber",
  },
  {
    tag: "Road to the Ranch",
    title: "Track the ladder, together.",
    body: "See attended qualifiers, advancement positions, and the exact path to Nationals — by region, by class, by rider. The thing every family chasing the dream has been doing on a napkin until now.",
    accent: "green",
  },
  {
    tag: "The Tower",
    title: "Help your home track thrive.",
    body: "Online registration, series points and live standings, attendee comms, and one-click economic-impact reports — affordable tools for the family-run tracks that hold this whole thing together.",
    accent: "ignition",
  },
  {
    tag: "The Garage",
    title: "Crew like the pros do.",
    body: "Setup database by track and conditions, an endurance stint planner with live fuel math, and sponsor portfolios — shared with everyone wearing your colors.",
    accent: "amber",
  },
  {
    tag: "The Frontline",
    title: "When a track is threatened, we show up.",
    body: "A Right to Race bill tracker across 14 states, an endangered-tracks map, and one-tap legislator contact. Because the places we gather are worth standing up for — and nobody should fight for them alone.",
    accent: "green",
  },
];

const tickers = [
  "Nobody races alone",
  "Motocross",
  "First race? You belong here",
  "Autocross",
  "Pass it down",
  "Road Racing",
  "Hold the line together",
  "Endurance",
  "Save your home track",
  "Short Track",
  "From the PW50 to the pit chair",
  "Karting",
];

export default function Landing() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    api.stats().then((r) => setStats(r.stats)).catch(() => {});
  }, []);

  return (
    <div>
      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <div className="relative flex min-h-[82vh] items-center">
          <AiImage
            slug="hero"
            kenBurns
            overlay={false}
            className="absolute inset-0 h-full w-full"
            imgClassName="opacity-90"
          />
          {/* legibility scrims — let the rider show, keep text crisp */}
          <div className="absolute inset-0 bg-gradient-to-t from-carbon-950 via-carbon-950/55 to-carbon-950/15" />
          <div className="absolute inset-0 hidden bg-gradient-to-r from-carbon-950/90 via-carbon-950/40 to-transparent lg:block" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-carbon-950 to-transparent" />
          <SpeedLines className="opacity-70" />

          <div className="container-page relative grid w-full gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="animate-fade-up">
            <div className="mb-5 flex items-center gap-3">
              <Badge tone="live">
                <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-ignition" />
                Now in beta · 2026 season
              </Badge>
            </div>
            <h1 className="font-display text-5xl font-black leading-[0.92] tracking-tightest text-white drop-shadow-[0_2px_30px_rgba(0,0,0,0.8)] sm:text-6xl lg:text-[5.25rem]">
              Grassroots
              <br />
              motorsports,
              <br />
              <span className="bg-gradient-to-r from-ignition via-ignition-300 to-amber bg-clip-text text-transparent">
                in motion.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/70">
              One home for the whole racing family — the calendar, your riders, the ladder, and the
              people who pull in beside you. Because nobody should have to figure this out alone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary px-6 py-3 text-base">
                Find your people →
              </Link>
              <Link to="/demo" className="btn-ghost px-6 py-3 text-base backdrop-blur">
                ▶ Try the live demo
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/45">
              Free forever for the calendar &amp; the cause. No card, no catch.
            </p>
          </div>

          <div className="hidden animate-fade-up [animation-delay:140ms] lg:block">
            <LadderPreview />
          </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="border-y border-white/[0.08] bg-carbon-950/70 backdrop-blur">
          <div className="container-page grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
            <StatBlock value={stats?.upcoming_events} label="Events on The Grid" />
            <StatBlock value={stats?.tracks} label="Tracks in the network" />
            <StatBlock value={stats?.active_bills} label="Right-to-Race bills live" />
            <StatBlock value={stats?.enacted_bills} label="Tracks already protected" />
          </div>
        </div>
      </section>

      {/* ─── THE NATIONAL CANVAS ──────────────────────────────── */}
      <HeroCanvas />

      {/* ─── TICKER ───────────────────────────────────────────── */}
      <section className="border-b border-white/[0.06] bg-carbon-900/40 py-4">
        <Marquee>
          {tickers.map((t, i) => (
            <span key={i} className="flex items-center gap-8 whitespace-nowrap">
              <span className="font-display text-sm font-bold uppercase tracking-widest text-white/55">
                {t}
              </span>
              <span className="h-1.5 w-1.5 rotate-45 bg-ignition/70" />
            </span>
          ))}
        </Marquee>
      </section>

      {/* ─── COMMUNITY: NOBODY RACES ALONE ────────────────────── */}
      <section className="container-page py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <Reveal>
            <AiImage
              slug="paddock"
              kenBurns
              className="aspect-[4/3] w-full rounded-3xl border border-white/10 shadow-panel"
            />
          </Reveal>
          <div>
            <Reveal>
              <p className="eyebrow">Nobody races alone</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tightest sm:text-4xl">
                A paddock is more than a parking lot. It's a place you belong.
              </h2>
              <p className="mt-4 text-white/60">
                The best part of this sport was never the trophies. It's the neighbor who lends you
                a tool, the family that waves you into the spot next to theirs, the people who learn
                your kid's number and cheer like it's their own. inmotu is built to protect that —
                and put it in everyone's pocket.
              </p>
            </Reveal>
            <div className="mt-8 space-y-4">
              {[
                ["A place in the paddock", "Every family gets a profile and a crew from day one. First race or fiftieth, there's room for you here."],
                ["We show up for each other", "Shared calendars, event updates from your tracks, and crew-ready event details — the help that used to mean knocking on the next trailer over."],
                ["What we build, we hand down", "From the four-year-old on a PW50 to the grandparent in the pit chair. We're keeping this alive for whoever's next."],
              ].map(([t, b], i) => (
                <Reveal key={t} delay={i * 90}>
                  <div className="flex gap-4">
                    <div className="mt-1 h-10 w-1 shrink-0 rounded-full bg-gradient-to-b from-ignition to-amber" />
                    <div>
                      <h3 className="font-display text-lg font-bold text-white">{t}</h3>
                      <p className="text-sm text-white/55">{b}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── THE PROBLEM ──────────────────────────────────────── */}
      <section className="container-page pb-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">Why we built this</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tightest sm:text-4xl">
            The most committed community in sports — scattered across ten apps and a hundred group
            chats.
          </h2>
          <p className="mt-4 text-white/60">
            Hundreds of thousands of families pour everything into this. They deserve more than
            missed deadlines, paper sign-in sheets, and the feeling of doing it all alone. inmotu
            pulls it together — and turns a scattered crowd into a community that can look after its
            own.
          </p>
        </Reveal>
      </section>

      {/* ─── MODULES ──────────────────────────────────────────── */}
      <section className="container-page py-16">
        <Reveal className="mb-10">
          <p className="eyebrow">Five tools, one family</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tightest sm:text-4xl">
            Everything the paddock needs — built for everyone in it.
          </h2>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => (
            <Reveal key={m.tag} delay={(i % 3) * 80}>
              <ModuleCard {...m} index={i} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── ACTION GALLERY ───────────────────────────────────── */}
      <section className="py-10">
        <Marquee speed="marquee-slow" className="gap-4">
          {["mx", "car", "start", "frontline"].map((s) => (
            <div
              key={s}
              className="relative h-56 w-80 shrink-0 overflow-hidden rounded-2xl border border-white/10 sm:h-64 sm:w-[26rem]"
            >
              <AiImage slug={s} className="h-full w-full" kenBurns />
            </div>
          ))}
        </Marquee>
      </section>

      {/* ─── SEE IT IN ACTION ─────────────────────────────────── */}
      <section className="container-page py-20">
        <Reveal className="mx-auto mb-6 max-w-2xl text-center">
          <p className="eyebrow">See it in action</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tightest sm:text-4xl">
            The whole season, on one screen.
          </h2>
          <p className="mt-3 text-white/60">
            Real tools, not mockups. Here's what your weekends look like inside inmotu.
          </p>
        </Reveal>

        <FeatureRow
          eyebrow="The Grid"
          title="Find where your people race next."
          body="Every grassroots event near you in one feed — filtered to your disciplines and class, with a nudge before registration closes so you never miss the weekend that matters."
          cta={["Browse The Grid", "/grid"]}
          shot={
            <BrowserFrame url="/grid" tilt>
              <ShotGrid />
            </BrowserFrame>
          }
        />

        <FeatureRow
          reverse
          eyebrow="The Garage"
          title="Crew like the pros do."
          body="Plan an entire enduro in seconds — stint counts, pit stops, fuel windows, and driver rotation update live as you type. Setups, parts, and sponsors live here too."
          cta={["See the plans", "/pricing"]}
          shot={
            <BrowserFrame url="/app" tilt>
              <ShotStint />
            </BrowserFrame>
          }
        />

        <FeatureRow
          eyebrow="The Frontline"
          title="Stand with your track."
          body="Track every Right to Race bill, watch it move through the statehouse, and reach your representative in a single tap. Free forever — because no track should fight alone."
          cta={["Open The Frontline", "/frontline"]}
          shot={
            <BrowserFrame url="/frontline" tilt>
              <ShotFrontline />
            </BrowserFrame>
          }
        />

        {/* Collage: operator + family */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <Reveal>
            <p className="eyebrow mb-3">The Tower · for operators</p>
            <BrowserFrame url="/app" tilt>
              <ShotTower />
            </BrowserFrame>
          </Reveal>
          <Reveal delay={120}>
            <p className="eyebrow mb-3">The Pit Board · for families</p>
            <BrowserFrame url="/app" tilt>
              <ShotBudget />
            </BrowserFrame>
          </Reveal>
        </div>
      </section>

      {/* ─── ADVOCACY ─────────────────────────────────────────── */}
      <section className="container-page py-24">
        <Reveal>
          <div className="panel relative overflow-hidden">
            <AiImage slug="frontline" className="absolute inset-0 h-full w-full" overlay={false} imgClassName="opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-r from-carbon-900 via-carbon-900/90 to-carbon-900/40" />
            <SpeedLines className="opacity-50" />
            <div className="relative grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <Badge tone="red">The cause</Badge>
                <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tightest sm:text-4xl">
                  When a track is threatened, we don't watch it close.
                </h2>
                <p className="mt-4 max-w-xl text-white/65">
                  These places have anchored their communities for generations. When developers and
                  noise suits come for them, families shouldn't have to fight alone. The Frontline
                  tracks every Right to Race bill, maps the tracks under threat, and gets your voice
                  to your representative in a single tap — and it's free forever.
                </p>
                <Link to="/frontline" className="btn-primary mt-6">
                  Stand with your track →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Iowa", "Protected ✓"],
                  ["N. Carolina", "Protected ✓"],
                  ["Tennessee", "Passed chamber"],
                  ["Minnesota", "In committee"],
                ].map(([s, st], i) => (
                  <Reveal key={s} delay={i * 80}>
                    <div className="rounded-xl border border-white/10 bg-carbon-950/70 p-4 backdrop-blur">
                      <div className="font-display text-lg font-bold text-white">{s}</div>
                      <div className="mt-1 text-xs font-medium text-ignition-300">{st}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────────── */}
      <section className="container-page pb-28">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-3xl border border-ignition/30 p-10 text-center sm:p-16">
            <AiImage slug="start" className="absolute inset-0 -z-10 h-full w-full" overlay={false} kenBurns imgClassName="opacity-40" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-carbon-950/80 via-carbon-950/70 to-carbon-950/90" />
            <SpeedLines className="-z-10" />
            <h2 className="font-display text-4xl font-black tracking-tightest drop-shadow-lg sm:text-5xl">
              Pull into the paddock.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-white/70">
              Join the families and tracks building the backbone of American grassroots racing —
              one weekend, one rider, one saved track at a time.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register" className="btn-primary px-7 py-3.5 text-base">
                Create your free account
              </Link>
              <Link to="/pricing" className="btn-ghost px-7 py-3.5 text-base backdrop-blur">
                See plans
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function FeatureRow({
  eyebrow,
  title,
  body,
  cta,
  shot,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta?: [string, string];
  shot: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 py-8 lg:grid-cols-2 lg:gap-16">
      <Reveal className={reverse ? "lg:order-2" : ""}>
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="mt-2 font-display text-2xl font-extrabold tracking-tightest sm:text-3xl">{title}</h3>
        <p className="mt-3 max-w-md text-white/60">{body}</p>
        {cta && (
          <Link to={cta[1]} className="btn-ghost mt-5">
            {cta[0]} →
          </Link>
        )}
      </Reveal>
      <Reveal delay={120} y={28} className={`relative ${reverse ? "lg:order-1" : ""}`}>
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-ignition/10 blur-3xl" />
        {shot}
      </Reveal>
    </div>
  );
}

function StatBlock({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl font-extrabold text-white sm:text-4xl">
        {value == null ? "—" : <CountUp key={value} to={value} />}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-white/45">{label}</div>
    </div>
  );
}

function ModuleCard({
  tag,
  title,
  body,
  accent,
  index,
}: {
  tag: string;
  title: string;
  body: string;
  accent: string;
  index: number;
}) {
  const dot = accent === "amber" ? "bg-amber" : accent === "green" ? "bg-flag-green" : "bg-ignition";
  return (
    <div className="panel group relative h-full overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-ignition/0 blur-2xl transition-colors duration-500 group-hover:bg-ignition/10"
      />
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot} transition group-hover:animate-pulse-live`} />
        <span className="text-xs font-bold uppercase tracking-wider text-white/50">{tag}</span>
        <span className="ml-auto font-mono text-xs text-white/20">0{index + 1}</span>
      </div>
      <h3 className="font-display text-xl font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
      <div className="mt-4 h-px w-0 bg-gradient-to-r from-ignition to-amber transition-all duration-500 group-hover:w-full" />
    </div>
  );
}

function LadderPreview() {
  const stages = [
    { name: "Area Qualifier", place: "P2", done: true, region: "North Central" },
    { name: "Regional Championship", place: "P4", done: true, region: "North Central" },
    { name: "AMA Amateur National", place: "—", done: false, region: "the Ranch" },
  ];
  return (
    <div className="panel overflow-hidden shadow-glow animate-float">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse-live rounded-full bg-flag-green" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
            Road to the Ranch · Live
          </span>
        </div>
        <span className="font-mono text-xs text-white/30">85cc (10-12)</span>
      </div>
      <div className="space-y-2 p-5">
        {stages.map((s, i) => (
          <div
            key={s.name}
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              s.done ? "border-flag-green/20 bg-flag-green/[0.06]" : "border-white/[0.06] bg-carbon-900/50"
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg font-display text-sm font-bold ${
                s.done ? "bg-flag-green/20 text-flag-green" : "bg-white/[0.04] text-white/40"
              }`}
            >
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{s.name}</div>
              <div className="text-xs text-white/40">{s.region}</div>
            </div>
            <div className={`font-display text-lg font-extrabold ${s.done ? "text-flag-green" : "text-white/25"}`}>
              {s.place}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.06] px-5 py-3 text-xs text-white/40">
        2 of 3 cleared · the whole crew's behind you
      </div>
    </div>
  );
}

// The national canvas, front and center on the homepage — every motorsports
// venue in America, live. The single most impressive thing we can show.
function HeroCanvas() {
  const [venues, setVenues] = useState<VenuePin[]>([]);
  const [stats, setStats] = useState<{ total: number; states: number } | null>(null);

  useEffect(() => {
    Promise.all([api.venues({ limit: "10000" }), api.venueStats()])
      .then(([v, s]) => {
        setVenues(v.venues);
        setStats({ total: s.total, states: s.states });
      })
      .catch(() => {});
  }, []);

  if (venues.length === 0) return null;

  return (
    <section className="container-page py-16">
      <div className="mb-6 text-center">
        <p className="eyebrow">The National Canvas</p>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tightest sm:text-4xl">
          {stats ? `${stats.total.toLocaleString()} tracks. ${stats.states} states.` : "Every track in America."}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-white/55">
          The most complete map of grassroots motorsports anywhere — and it grows every day.
        </p>
      </div>
      <VenueMap venues={venues} height="min(64vh, 600px)" intro />
      <div className="mt-5 text-center">
        <Link to="/map" className="btn-primary px-6 py-3">
          Explore the full canvas →
        </Link>
      </div>
    </section>
  );
}
