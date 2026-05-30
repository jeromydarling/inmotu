import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "live" | "amber" | "green" | "red" | "muted";
}) {
  const tones: Record<string, string> = {
    default: "border-white/10 bg-white/[0.05] text-white/70",
    live: "border-ignition/40 bg-ignition/15 text-ignition-300",
    amber: "border-amber/30 bg-amber/15 text-amber-400",
    green: "border-flag-green/30 bg-flag-green/15 text-flag-green",
    red: "border-flag-red/30 bg-flag-red/15 text-flag-red",
    muted: "border-white/5 bg-white/[0.02] text-white/40",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-ignition ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="text-3xl">🏁</div>
      <p className="font-display text-lg font-bold text-white">{title}</p>
      {hint && <p className="max-w-sm text-sm text-white/50">{hint}</p>}
    </div>
  );
}

export function Pill({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
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

const PLAN_LABEL: Record<string, string> = {
  family: "Family",
  pro: "Pro / Team",
  tower: "The Tower",
};

/** Shown in place of a gated feature with a clear upgrade CTA. */
export function UpgradePrompt({
  plan,
  feature,
  blurb,
}: {
  plan: "family" | "pro" | "tower";
  feature: string;
  blurb?: string;
}) {
  return (
    <div className="panel relative overflow-hidden p-8 text-center sm:p-12">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ignition/10 blur-3xl" />
      <div className="relative">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-ignition/15 text-2xl">
          🔒
        </div>
        <Badge tone="live">{PLAN_LABEL[plan]} plan</Badge>
        <h3 className="mt-3 font-display text-2xl font-extrabold tracking-tightest">{feature}</h3>
        {blurb && <p className="mx-auto mt-2 max-w-md text-sm text-white/55">{blurb}</p>}
        <Link to="/pricing" className="btn-primary mt-6">
          Upgrade to {PLAN_LABEL[plan]} →
        </Link>
      </div>
    </div>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl font-extrabold text-white sm:text-4xl">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-white/45">{label}</div>
    </div>
  );
}
