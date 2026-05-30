import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { EventItem, Rider } from "@shared/types";
import { useAuth } from "../state/auth";
import { EventCard } from "../components/EventCard";
import { Badge, EmptyState, Spinner } from "../components/ui";
import { fmtMoney, titleCase } from "../lib/format";

type Tab = "calendar" | "riders" | "budget";

export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("calendar");

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

      <div className="mb-8 flex gap-1 rounded-xl border border-white/[0.06] bg-carbon-900/50 p-1">
        {([
          ["calendar", "My Calendar"],
          ["riders", "Riders"],
          ["budget", "Budget"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t ? "bg-ignition text-white shadow-glow" : "text-white/55 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "calendar" && <CalendarTab />}
      {tab === "riders" && <RidersTab />}
      {tab === "budget" && <BudgetTab />}
    </div>
  );
}

function CalendarTab() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.savedEvents().then((r) => setEvents(r.events)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function unsave(e: EventItem) {
    setEvents((p) => p.filter((x) => x.id !== e.id));
    await api.toggleSave(e.id).catch(() => {});
  }

  if (loading) return <Spinner className="mx-auto h-8 w-8" />;
  if (events.length === 0)
    return (
      <EmptyState
        title="Your calendar is empty"
        hint="Save events from The Grid and they'll show up here with deadline alerts."
      />
    );
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {events.map((e) => (
        <EventCard key={e.id} e={e} onSave={unsave} />
      ))}
    </div>
  );
}

function RidersTab() {
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
    await api.createRider(form);
    setForm({ name: "", race_class: "", number: "", discipline: "motocross" });
    setShow(false);
    load();
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
            </div>
          ))}
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
