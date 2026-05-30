import type { ReactNode } from "react";
import { AiImage } from "./motion";

/* ──────────────────────────────────────────────────────────────────────
 * Chromeless browser frame — wraps a live mini-render of the app so the
 * marketing page shows real UI "in action" rather than flat screenshots.
 * ────────────────────────────────────────────────────────────────────── */
export function BrowserFrame({
  children,
  url = "",
  className = "",
  tilt = false,
}: {
  children: ReactNode;
  url?: string;
  className?: string;
  tilt?: boolean;
}) {
  return (
    <div
      className={`group/frame overflow-hidden rounded-2xl border border-white/10 bg-carbon-850 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.03] transition duration-500 ${
        tilt ? "hover:-translate-y-1.5 hover:rotate-[0.3deg]" : ""
      } ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-carbon-900/90 px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-flag-red/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-flag-green/70" />
        <div className="mx-auto flex items-center gap-1.5 rounded-md border border-white/5 bg-carbon-800 px-3 py-1 text-[11px] font-medium text-white/40">
          <svg viewBox="0 0 24 24" className="h-3 w-3 fill-flag-green/70">
            <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm3 8H9V6a3 3 0 0 1 6 0v3Z" />
          </svg>
          inmotu.pro{url}
        </div>
      </div>
      <div className="relative bg-carbon-950">{children}</div>
    </div>
  );
}

const Dot = ({ c }: { c: string }) => <span className={`h-2 w-2 rounded-full ${c}`} />;

function MiniBadge({ children, tone = "muted" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    live: "border-ignition/40 bg-ignition/15 text-ignition-300",
    amber: "border-amber/30 bg-amber/15 text-amber-400",
    green: "border-flag-green/30 bg-flag-green/15 text-flag-green",
    red: "border-flag-red/30 bg-flag-red/15 text-flag-red",
    muted: "border-white/10 bg-white/[0.04] text-white/55",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ── The Grid ─────────────────────────────────────────────────────── */
export function ShotGrid() {
  const rows = [
    { disc: "disc-motocross", mon: "JUN", day: "6", title: "North Central Area Qualifier", sub: "Spring Creek MX · MN", badge: ["qualifier", "amber"], soon: true },
    { disc: "disc-road-race", mon: "JUN", day: "13", title: "SCCA Land O' Lakes Club Race", sub: "Brainerd Int'l · MN", badge: ["club", "muted"] },
    { disc: "disc-endurance", mon: "JUN", day: "20", title: "ChampCar 14-Hour Enduro", sub: "Road America · WI", badge: ["club", "muted"] },
  ] as const;
  return (
    <div className="space-y-2.5 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-display text-sm font-bold text-white">The Grid</span>
        <div className="flex gap-1">
          <MiniBadge tone="live">All</MiniBadge>
          <MiniBadge>Motocross</MiniBadge>
        </div>
      </div>
      {rows.map((r) => (
        <div key={r.title} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-carbon-850 p-2.5">
          <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10">
            <AiImage slug={r.disc} className="h-full w-full" kenBurns />
            <div className="absolute bottom-1 left-1 rounded bg-carbon-950/80 px-1 text-center backdrop-blur">
              <div className="text-[8px] font-bold leading-none text-ignition">{r.mon}</div>
              <div className="font-display text-xs font-extrabold leading-none text-white">{r.day}</div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <MiniBadge tone={r.badge[1]}>{r.badge[0]}</MiniBadge>
              {"soon" in r && r.soon && (
                <MiniBadge tone="red">
                  <Dot c="bg-flag-red animate-pulse-live" /> Reg 2d
                </MiniBadge>
              )}
            </div>
            <div className="mt-1 truncate text-xs font-bold text-white">{r.title}</div>
            <div className="truncate text-[11px] text-white/40">{r.sub}</div>
          </div>
          <span className="text-white/25">☆</span>
        </div>
      ))}
    </div>
  );
}

/* ── The Garage · stint planner ───────────────────────────────────── */
export function ShotStint() {
  const drivers = ["Alex", "Sam", "Jess"];
  const stints = 8;
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-sm font-bold text-white">Stint Planner</span>
        <MiniBadge tone="live"><Dot c="bg-flag-green animate-pulse-live" /> Live</MiniBadge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[["Race", "840m"], ["Stint", "110m"], ["Fuel", "115m"]].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-white/10 bg-carbon-850 p-2 text-center">
            <div className="font-display text-base font-extrabold text-white">{v}</div>
            <div className="text-[10px] uppercase tracking-wide text-white/40">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-carbon-900/70 p-2.5">
        <MiniBadge tone="live">{stints} stints</MiniBadge>
        <MiniBadge tone="amber">{stints - 1} stops</MiniBadge>
        <MiniBadge tone="green">Fuel OK</MiniBadge>
      </div>
      <div className="mt-2.5 flex items-center gap-1 overflow-hidden">
        {Array.from({ length: stints }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="h-8 w-full origin-bottom rounded bg-gradient-to-t from-ignition/30 to-ignition"
              style={{ animation: `bar-grow .5s ${i * 80}ms both cubic-bezier(.16,1,.3,1)` }}
            />
            <span className="text-[9px] text-white/45">{drivers[i % drivers.length]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── The Frontline · bill tracker ─────────────────────────────────── */
export function ShotFrontline() {
  const bills = [
    { st: "Iowa", n: "HF 100", label: "Enacted", pct: 100, tone: "green" },
    { st: "Tennessee", n: "HB 0712", label: "Passed chamber", pct: 70, tone: "amber" },
    { st: "Minnesota", n: "SF 2210", label: "In committee", pct: 45, tone: "amber" },
  ] as const;
  return (
    <div className="space-y-2.5 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-display text-sm font-bold text-white">The Frontline</span>
        <MiniBadge tone="red">14 bills live</MiniBadge>
      </div>
      {bills.map((b) => (
        <div key={b.st} className="rounded-xl border border-white/[0.06] bg-carbon-850 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-bold text-white">{b.st}</span>
              <span className="font-mono text-[10px] text-white/35">{b.n}</span>
            </div>
            <MiniBadge tone={b.tone}>{b.label}</MiniBadge>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${b.tone === "green" ? "bg-flag-green" : "bg-amber"}`}
              style={{ width: `${b.pct}%` }}
            />
          </div>
        </div>
      ))}
      <button className="w-full rounded-lg border border-ignition/40 bg-ignition/15 py-1.5 text-[11px] font-semibold text-ignition-300">
        ✉ Contact your representative
      </button>
    </div>
  );
}

/* ── The Tower · economic impact ──────────────────────────────────── */
export function ShotTower() {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-sm font-bold text-white">Economic Impact</span>
        <MiniBadge tone="green">Friday Practice</MiniBadge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[["Entries", "112", false], ["Fees", "$5,040", false], ["Local impact", "$38,080", true]].map(
          ([l, v, hi]) => (
            <div key={l as string} className="rounded-lg border border-white/10 bg-carbon-850 p-2 text-center">
              <div className={`font-display text-base font-extrabold ${hi ? "text-ignition" : "text-white"}`}>{v}</div>
              <div className="text-[9px] uppercase tracking-wide text-white/40">{l}</div>
            </div>
          ),
        )}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-white/40">
        Entries × ~$340 avg spend — ready to hand to local officials in a Right-to-Race brief.
      </p>
      <div className="mt-2 space-y-1.5">
        {[["Cole D.", "85cc (10-12)"], ["Mara T.", "Spec Miata"]].map(([n, c]) => (
          <div key={n} className="flex items-center justify-between rounded-lg bg-carbon-850 px-2.5 py-1.5 text-[11px]">
            <span className="font-medium text-white">{n}</span>
            <span className="text-white/40">{c}</span>
            <MiniBadge tone="green">confirmed</MiniBadge>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── The Pit Board · season budget ────────────────────────────────── */
export function ShotBudget() {
  const cats: [string, number, number][] = [
    ["Entry fees", 2840, 65],
    ["Travel", 4120, 95],
    ["Maintenance", 3380, 78],
    ["Gear", 1560, 36],
  ];
  return (
    <div className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-sm font-bold text-white">Season Budget</span>
        <span className="font-display text-base font-extrabold text-white">$11,900</span>
      </div>
      <div className="space-y-2">
        {cats.map(([l, v, pct], i) => (
          <div key={l}>
            <div className="mb-0.5 flex justify-between text-[11px]">
              <span className="text-white/55">{l}</span>
              <span className="font-semibold text-white">${v.toLocaleString()}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full origin-left rounded-full bg-gradient-to-r from-ignition to-amber"
                style={{ width: `${pct}%`, animation: `bar-grow .6s ${i * 90}ms both` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
