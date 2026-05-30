import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Badge, Stat } from "../components/ui";

const modules = [
  {
    tag: "The Grid",
    title: "Every race. One calendar.",
    body: "The first unified feed of every sanctioned amateur event in America — motocross, autocross, road race, endurance, short track — filtered to your disciplines, region, and class. Smart deadline alerts so you never miss a Monday cutoff.",
    accent: "ignition",
  },
  {
    tag: "The Pit Board",
    title: "Your whole racing family, organized.",
    body: "Multi-rider profiles, digital licenses and waivers, maintenance logs, gear checklists, and a season budget tracker built for families spending real money to chase the ladder.",
    accent: "amber",
  },
  {
    tag: "Road to Loretta's",
    title: "Track the ladder in real time.",
    body: "The qualifying tracker no one else has. See attended Area Qualifiers, advancement positions, and the exact path to Nationals — by region, by class, by rider.",
    accent: "green",
  },
  {
    tag: "The Tower",
    title: "Run your track like a business.",
    body: "Online registration, waivers, payments, series points, sponsor CRM, and one-click economic-impact reports — affordable software for the family-run tracks that hold this sport together.",
    accent: "ignition",
  },
  {
    tag: "The Garage",
    title: "Team ops that rival the pros.",
    body: "Setup database by track and conditions, endurance stint planner with fuel windows, live cellular pit board, parts inventory, and sponsorship portfolios — priced for mortals.",
    accent: "amber",
  },
  {
    tag: "The Frontline",
    title: "Fight to keep tracks alive.",
    body: "Right to Race bill tracker across 14 states, an endangered-tracks map, and one-tap legislator contact. The advocacy network no commercial competitor would ever build.",
    accent: "green",
  },
];

export default function Landing() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    api.stats().then((r) => setStats(r.stats)).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid-fade" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
          style={{ background: "linear-gradient(90deg,transparent,rgba(255,77,20,.6),transparent)" }}
        />
        <div className="container-page relative grid gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="animate-fade-up">
            <div className="mb-5 flex items-center gap-3">
              <Badge tone="live">
                <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-ignition" />
                Now in beta · 2026 season
              </Badge>
            </div>
            <h1 className="font-display text-5xl font-black leading-[0.95] tracking-tightest text-white sm:text-6xl lg:text-7xl">
              Grassroots
              <br />
              motorsports,
              <br />
              <span className="text-ignition">in motion.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/60">
              One app for the family in the pits: the unified event calendar, your riders, your
              budget, the qualifying ladder, and the fight to keep local tracks alive. Built to
              rival pro tools — priced for the paddock.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary px-5 py-3 text-base">
                Start free →
              </Link>
              <Link to="/grid" className="btn-ghost px-5 py-3 text-base">
                Browse The Grid
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/35">
              Free forever for the calendar &amp; advocacy tools. No card required.
            </p>
          </div>

          {/* Hero card: live ladder snapshot */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <LadderPreview />
          </div>
        </div>

        {/* Stat strip */}
        <div className="border-y border-white/[0.06] bg-carbon-900/40">
          <div className="container-page grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
            <Stat value={stats ? stats.upcoming_events : "—"} label="Upcoming events" />
            <Stat value={stats ? stats.tracks : "—"} label="Tracks tracked" />
            <Stat value={stats ? stats.active_bills : "—"} label="Active Right-to-Race bills" />
            <Stat value={stats ? stats.enacted_bills : "—"} label="Laws enacted" />
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="container-page py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">The white space</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">
            The most expensive youth sport in America runs on Facebook groups and paper sign-in
            sheets.
          </h2>
          <p className="mt-4 text-white/55">
            Hundreds of thousands of families and 70,000+ SCCA members deserve better than scattered
            calendars, missed deadlines, and ten different apps. inmotu unifies all of it — and
            turns the community into a force that can save the tracks themselves.
          </p>
        </div>
      </section>

      {/* Modules */}
      <section className="container-page pb-8">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="eyebrow">Five modules, one identity</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
              Built for everyone in the paddock.
            </h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => (
            <ModuleCard key={m.tag} {...m} index={i} />
          ))}
        </div>
      </section>

      {/* Advocacy band */}
      <section className="container-page py-20">
        <div className="panel relative overflow-hidden p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-ignition/10 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <Badge tone="red">The moat</Badge>
              <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">
                Tracks are dying. We're building the network that fights back.
              </h2>
              <p className="mt-4 max-w-xl text-white/60">
                14 state legislatures have Right to Race bills moving right now. SEMA lobbies, the
                AMA tracks bills on a text-only web page — but no app helps everyday families
                monitor legislation, contact reps, and organize. The Frontline does, and it's free
                forever.
              </p>
              <Link to="/frontline" className="btn-primary mt-6">
                Open The Frontline →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Iowa", "Enacted ✓"],
                ["N. Carolina", "Enacted ✓"],
                ["Tennessee", "Passed chamber"],
                ["Minnesota", "In committee"],
              ].map(([s, st]) => (
                <div key={s} className="rounded-xl border border-white/10 bg-carbon-900/60 p-4">
                  <div className="font-display text-lg font-bold text-white">{s}</div>
                  <div className="mt-1 text-xs font-medium text-ignition-300">{st}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container-page pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-ignition/30 bg-gradient-to-br from-ignition/15 via-carbon-850 to-carbon-900 p-10 text-center sm:p-16">
          <h2 className="font-display text-4xl font-black tracking-tightest sm:text-5xl">
            Your season starts here.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-white/60">
            Join the families and tracks building the backbone of American grassroots racing.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn-primary px-6 py-3 text-base">
              Create your free account
            </Link>
            <Link to="/pricing" className="btn-ghost px-6 py-3 text-base">
              See plans
            </Link>
          </div>
        </div>
      </section>
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
  const dot =
    accent === "amber" ? "bg-amber" : accent === "green" ? "bg-flag-green" : "bg-ignition";
  return (
    <div className="panel group p-6 transition hover:-translate-y-0.5 hover:border-white/15">
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-xs font-bold uppercase tracking-wider text-white/50">{tag}</span>
        <span className="ml-auto font-mono text-xs text-white/20">0{index + 1}</span>
      </div>
      <h3 className="font-display text-xl font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
    </div>
  );
}

function LadderPreview() {
  const stages = [
    { name: "Area Qualifier", place: "P2", done: true, region: "North Central" },
    { name: "Regional Championship", place: "P4", done: true, region: "North Central" },
    { name: "AMA Amateur National", place: "—", done: false, region: "Loretta Lynn's" },
  ];
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse-live rounded-full bg-flag-green" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
            Road to Loretta's · Live
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
            <div
              className={`font-display text-lg font-extrabold ${
                s.done ? "text-flag-green" : "text-white/25"
              }`}
            >
              {s.place}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.06] px-5 py-3 text-xs text-white/40">
        2 of 3 stages cleared · advancing to Nationals
      </div>
    </div>
  );
}
