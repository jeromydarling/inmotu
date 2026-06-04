import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiErr } from "../api/client";
import type { EventItem, Rider } from "@shared/types";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import { EventCard } from "../components/EventCard";
import { Badge, EmptyState, Spinner, UpgradePrompt } from "../components/ui";
import { fmtMoney, titleCase } from "../lib/format";
import { primarySector } from "../lib/sector";
import GaragePanel from "./panels/GaragePanel";
import TowerPanel from "./panels/TowerPanel";
import LadderPanel from "./panels/LadderPanel";
import PhotosPanel from "./panels/PhotosPanel";
import MaintenancePanel from "./panels/MaintenancePanel";
import SponsorsPanel from "./panels/SponsorsPanel";
import StudioPanel from "./panels/StudioPanel";
import TeamPagePanel from "./panels/TeamPagePanel";
import { OnboardingChecklist } from "../components/OnboardingChecklist";

type Tab =
  | "calendar"
  | "ladder"
  | "riders"
  | "photos"
  | "budget"
  | "maintenance"
  | "garage"
  | "sponsors"
  | "studio"
  | "microsite"
  | "tower";

// label, capability key (null = always available), upgrade plan + blurb.
const TABS: {
  id: Tab;
  label: string;
  cap: string | null;
  plan?: "family" | "pro" | "tower";
  blurb?: string;
}[] = [
  { id: "calendar", label: "Calendar", cap: null },
  { id: "ladder", label: "Ladder", cap: "ladder", plan: "family", blurb: "Track each racer's road to the top — log results and watch their qualifying status update live, tuned to your sport's real ladder." },
  { id: "riders", label: "Riders", cap: null },
  { id: "photos", label: "Photos", cap: "photos", plan: "family", blurb: "Build a season photo timeline and turn it into a printed yearbook." },
  { id: "budget", label: "Budget", cap: "budget", plan: "family", blurb: "Know your real season costs by category, year over year." },
  { id: "maintenance", label: "Maintenance", cap: "maintenance", plan: "family", blurb: "Service history per bike so you stay ahead of failures." },
  { id: "garage", label: "Garage", cap: "garage", plan: "pro", blurb: "Setup database and endurance stint planner for serious teams." },
  { id: "sponsors", label: "Sponsors", cap: "sponsors", plan: "pro", blurb: "Manage your sponsorship portfolio, deliverables, and renewals." },
  { id: "studio", label: "AI Studio", cap: "sponsors", plan: "pro", blurb: "Generate social posts, event promos, and sponsor thank-yous from your own season — in seconds." },
  { id: "microsite", label: "Microsite", cap: "sponsors", plan: "pro", blurb: "A shareable, SEO-friendly public page for your team — built with AI." },
  { id: "tower", label: "Tower", cap: "tower", plan: "tower", blurb: "Run your track: registration, series points, comms, and economic-impact reports." },
];

export default function Dashboard() {
  const { user, caps } = useAuth();
  const [tab, setTab] = useState<Tab>("calendar");

  const can = (cap: string | null) => cap === null || caps?.can?.[cap] !== false;
  const current = TABS.find((t) => t.id === tab)!;
  const allowed = can(current.cap);
  // Adapt the ladder tab to the user's sector ("Road to the #1 Plate" for BMX,
  // "Track Points to Vegas" for drag, etc.) — falls back to "Ladder".
  const ladderLabel = primarySector(user?.sectors)?.vocab.ladderName ?? "Ladder";

  return (
    <div className="container-page py-12">
      <header className="mb-8">
        <p className="eyebrow">The Pit Board</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest">
          Welcome back, {user?.full_name.split(" ")[0]}.
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone={user?.plan === "free" ? "muted" : "live"}>{titleCase(user?.plan || "free")} plan</Badge>
          <span className="text-sm text-white/45">{user?.email}</span>
        </div>
      </header>

      <VerifyEmailBanner />

      <OnboardingChecklist firstName={user?.full_name.split(" ")[0]} />

      <div className="mb-8 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-carbon-900/50 p-1">
        {TABS.map((t) => {
          const locked = !can(t.cap);
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === t.id ? "bg-ignition text-white shadow-glow" : "text-white/55 hover:text-white"
              }`}
            >
              {t.id === "ladder" ? ladderLabel : t.label}
              {locked && <span className="ml-1 text-white/40">🔒</span>}
            </button>
          );
        })}
      </div>

      {!allowed ? (
        <UpgradePrompt plan={current.plan!} feature={`${current.label} is a ${current.plan} feature`} blurb={current.blurb} />
      ) : (
        <>
          {tab === "calendar" && <CalendarTab />}
          {tab === "ladder" && <LadderPanel />}
          {tab === "riders" && <RidersTab />}
          {tab === "photos" && <PhotosPanel />}
          {tab === "budget" && <BudgetTab />}
          {tab === "maintenance" && <MaintenancePanel />}
          {tab === "garage" && <GaragePanel />}
          {tab === "sponsors" && <SponsorsPanel />}
          {tab === "studio" && <StudioPanel />}
          {tab === "microsite" && <TeamPagePanel />}
          {tab === "tower" && <TowerPanel />}
        </>
      )}
    </div>
  );
}

// Soft nudge (never blocks) for free users who haven't confirmed their email.
function VerifyEmailBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("hideVerifyBanner") === "1");
  const [busy, setBusy] = useState(false);

  if (!user || user.plan !== "free" || user.email_verified || dismissed) return null;

  async function resend() {
    setBusy(true);
    try {
      await api.resendVerification();
      toast.success("Confirmation email sent — check your inbox.");
    } catch (e: any) {
      toast.error(e.message || "Couldn't send right now. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    sessionStorage.setItem("hideVerifyBanner", "1");
    setDismissed(true);
  }

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-ignition/30 bg-ignition/[0.07] px-4 py-3">
      <span className="text-sm text-white/75">
        <span className="font-semibold text-white">Confirm your email</span> to unlock deadline reminders for the
        races you save.
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={resend} disabled={busy} className="btn-ghost btn-sm">
          {busy ? "Sending…" : "Resend email"}
        </button>
        <button onClick={dismiss} className="text-sm text-white/40 hover:text-white/70" aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}

function CalendarTab() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.savedEvents().then((r) => setEvents(r.events)).catch(() => {}).finally(() => setLoading(false));
    api.myUpdates().then((r) => setUpdates(r.updates)).catch(() => {});
  }, []);

  async function unsave(e: EventItem) {
    setEvents((p) => p.filter((x) => x.id !== e.id));
    await api.toggleSave(e.id).catch(() => {});
  }

  if (loading) return <Spinner className="mx-auto h-8 w-8" />;
  return (
    <div className="space-y-6">
      {updates.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-white/40">
            <span className="h-2 w-2 animate-pulse-live rounded-full bg-ignition" /> Updates from your events
          </h2>
          <div className="space-y-2">
            {updates.map((u) => (
              <div key={u.id} className={`panel p-4 ${u.urgent ? "border-flag-red/30" : ""}`}>
                <div className="flex items-center gap-2">
                  {u.urgent ? <Badge tone="red">Urgent</Badge> : <Badge tone="live">Update</Badge>}
                  <span className="text-xs text-white/40">{u.event_title}</span>
                </div>
                <div className="mt-1.5 font-semibold text-white">{u.title}</div>
                <p className="text-sm text-white/60">{u.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState
          title="Your calendar is empty"
          hint="Save events from The Grid and they'll show up here with their registration deadlines."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {events.map((e) => (
            <EventCard key={e.id} e={e} onSave={unsave} />
          ))}
        </div>
      )}
    </div>
  );
}

function RidersTab() {
  const nav = useNavigate();
  const toast = useToast();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", race_class: "", number: "", discipline: "motocross" });

  function load() {
    api.riders().then((r) => setRiders(r.riders)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await api.createRider(form);
      setForm({ name: "", race_class: "", number: "", discipline: "motocross" });
      setShow(false);
      load();
    } catch (err) {
      if (err instanceof ApiErr && err.code === "upgrade_required") {
        toast.error(err.message);
        nav("/pricing");
      } else {
        toast.error("Couldn't add rider. Try again.");
      }
    }
  }

  async function remove(id: string) {
    setRiders((p) => p.filter((r) => r.id !== id));
    await api.deleteRider(id).catch(load);
  }

  if (loading) return <Spinner className="mx-auto h-8 w-8" />;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShow((v) => !v)} className="btn-primary btn-sm">
          {show ? "Cancel" : "+ Add rider"}
        </button>
      </div>

      {show && (
        <form onSubmit={add} className="panel mb-6 grid gap-3 p-5 sm:grid-cols-4">
          <input
            className="field"
            placeholder="Rider name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="field"
            placeholder="Class (e.g. 85cc 10-12)"
            value={form.race_class}
            onChange={(e) => setForm({ ...form, race_class: e.target.value })}
          />
          <input
            className="field"
            placeholder="Number"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
          />
          <button className="btn-primary">Save rider</button>
        </form>
      )}

      {riders.length === 0 ? (
        <EmptyState title="No riders yet" hint="Add each racer in your family to track classes, licenses, and the ladder." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {riders.map((r) => (
            <div key={r.id} className="panel p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ignition/15 font-display text-lg font-black text-ignition">
                    {r.number || r.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="font-display text-lg font-bold">{r.name}</div>
                    <div className="text-xs text-white/45">{r.race_class || titleCase(r.discipline || "")}</div>
                  </div>
                </div>
                <button
                  onClick={() => remove(r.id)}
                  className="text-white/30 hover:text-flag-red"
                  aria-label="Remove rider"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="chip">{titleCase(r.discipline || "")}</span>
                {r.skill_level && <span className="chip">{titleCase(r.skill_level)}</span>}
              </div>
              <RiderResults riderId={r.id} />
              <PublishToggle rider={r} onChange={load} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Opt a racer into the public directory (privacy-first: off by default).
function PublishToggle({ rider, onChange }: { rider: any; onChange: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const published = !!rider.published;

  async function toggle() {
    setBusy(true);
    try {
      const r = await api.publishRider(rider.id, !published);
      toast.success(r.published ? "Public profile is live." : "Profile set to private.");
      onChange();
    } catch {
      toast.error("Couldn't update. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-white/70">Public profile</div>
        {published && rider.slug ? (
          <a href={`/racers/${rider.slug}`} target="_blank" rel="noreferrer" className="text-[11px] text-ignition-300 hover:underline">
            /racers/{rider.slug} ↗
          </a>
        ) : (
          <div className="text-[11px] text-white/40">Private — only you can see this racer</div>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${published ? "bg-flag-green" : "bg-white/15"}`}
        aria-pressed={published}
        aria-label="Toggle public profile"
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${published ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

// Recent timed results for a rider, matched from MYLAPS/Speedhive classifications.
function RiderResults({ riderId }: { riderId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[] | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows === null) {
      api.riderResults(riderId).then((r) => setRows(r.results)).catch(() => setRows([]));
    }
  }

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <button onClick={toggle} className="text-xs font-semibold text-white/55 hover:text-white">
        {open ? "▾" : "▸"} Recent results
      </button>
      {open && (
        <div className="mt-2">
          {rows === null ? (
            <p className="text-xs text-white/35">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-white/35">
              No timed results yet. Results sync automatically from MYLAPS/Speedhive once an event is linked.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {rows.slice(0, 5).map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-white/70">
                    <span className="font-display font-bold text-ignition-300">P{r.position ?? "—"}</span>{" "}
                    {r.event_title} · {r.session_name}
                  </span>
                  <span className="shrink-0 font-mono text-white/40">{r.best_lap ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function BudgetTab() {
  const [summary, setSummary] = useState<{ category: string; total: number }[]>([]);
  const [form, setForm] = useState({ category: "entry", amount: "", note: "" });

  function load() {
    api.budgetSummary().then((r) => setSummary(r.summary)).catch(() => {});
  }
  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(form.amount) * 100);
    if (!cents) return;
    await api.addBudget({ category: form.category, amount_cents: cents, note: form.note });
    setForm({ category: "entry", amount: "", note: "" });
    load();
  }

  const total = summary.reduce((s, r) => s + r.total, 0);
  const cats = ["entry", "travel", "maintenance", "gear"];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="panel p-6">
        <p className="eyebrow">Season total</p>
        <div className="mt-1 font-display text-4xl font-black text-white">{fmtMoney(total)}</div>
        <p className="mt-1 text-xs text-white/40">
          Youth MX families average ~$25K/season. Know your number.
        </p>
        <div className="mt-6 space-y-3">
          {cats.map((c) => {
            const row = summary.find((s) => s.category === c);
            const val = row?.total ?? 0;
            const pct = total ? (val / total) * 100 : 0;
            return (
              <div key={c}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="capitalize text-white/60">{c}</span>
                  <span className="font-semibold text-white">{fmtMoney(val)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-ignition" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={add} className="panel h-fit p-6">
        <h3 className="font-display text-lg font-bold">Log an expense</h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Category</label>
            <select
              className="field"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {cats.map((c) => (
                <option key={c} value={c} className="bg-carbon-900 capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount (USD)</label>
            <input
              className="field"
              type="number"
              step="0.01"
              min="0"
              placeholder="45.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Note</label>
            <input
              className="field"
              placeholder="Area qualifier entry"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <button className="btn-primary w-full">Add to budget</button>
        </div>
      </form>
    </div>
  );
}
