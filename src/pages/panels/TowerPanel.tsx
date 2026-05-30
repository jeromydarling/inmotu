import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Track } from "@shared/types";
import { Badge, EmptyState, Spinner } from "../../components/ui";
import { fmtDate, fmtMoney } from "../../lib/format";

export default function TowerPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    discipline: "motocross",
    level: "club",
    track_id: "",
    date: "",
    entry_fee: "",
  });

  function load() {
    api.towerEvents().then((r) => setEvents(r.events)).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.tracks().then((r) => setTracks(r.tracks)).catch(() => {});
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    const starts_at = Math.floor(new Date(form.date).getTime() / 1000);
    await api.createTowerEvent({
      title: form.title,
      discipline: form.discipline,
      level: form.level,
      track_id: form.track_id || null,
      starts_at,
      reg_closes_at: starts_at - 86400 * 5,
      entry_fee_cents: form.entry_fee ? Math.round(parseFloat(form.entry_fee) * 100) : null,
    });
    setForm({ ...form, title: "", date: "", entry_fee: "" });
    setShow(false);
    load();
  }

  if (loading) return <Spinner className="mx-auto h-8 w-8" />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/50">
          Run your track like a business — publish events, take registrations, prove your economic impact.
        </p>
        <button onClick={() => setShow((v) => !v)} className="btn-primary btn-sm shrink-0">
          {show ? "Cancel" : "+ New event"}
        </button>
      </div>

      {show && (
        <form onSubmit={create} className="panel mb-6 grid gap-3 p-5 sm:grid-cols-2">
          <input className="field sm:col-span-2" placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <select className="field" value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
            {["motocross", "autocross", "road-race", "endurance", "short-track", "karting"].map((d) => (
              <option key={d} value={d} className="bg-carbon-900">{d}</option>
            ))}
          </select>
          <select className="field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            {["beginner", "club", "qualifier", "regional", "national"].map((l) => (
              <option key={l} value={l} className="bg-carbon-900">{l}</option>
            ))}
          </select>
          <select className="field" value={form.track_id} onChange={(e) => setForm({ ...form, track_id: e.target.value })}>
            <option value="" className="bg-carbon-900">— Select track —</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id} className="bg-carbon-900">{t.name}</option>
            ))}
          </select>
          <input className="field" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <input className="field sm:col-span-2" type="number" step="0.01" placeholder="Entry fee (USD)" value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: e.target.value })} />
          <button className="btn-primary sm:col-span-2">Publish event</button>
        </form>
      )}

      {events.length === 0 ? (
        <EmptyState title="No events published" hint="Publish your first event to start taking registrations." />
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-lg font-bold text-white">{e.title}</div>
                  <div className="text-sm text-white/45">
                    {fmtDate(e.starts_at)} {e.track_name ? `· ${e.track_name}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="live">{e.reg_count} registered</Badge>
                  <button className="btn-ghost btn-sm" onClick={() => setOpen(open === e.id ? null : e.id)}>
                    {open === e.id ? "Hide" : "Manage"}
                  </button>
                </div>
              </div>
              {open === e.id && <RegistrationList eventId={e.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RegistrationList({ eventId }: { eventId: string }) {
  const [data, setData] = useState<{ registrations: any[]; impact: any } | null>(null);

  useEffect(() => {
    api.towerRegistrations(eventId).then(setData).catch(() => {});
  }, [eventId]);

  if (!data) return <Spinner className="mt-4 h-5 w-5" />;

  return (
    <div className="mt-4 border-t border-white/[0.06] pt-4">
      {/* Economic impact report */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Metric label="Entries" value={data.impact.entries} />
        <Metric label="Gross fees" value={fmtMoney(data.impact.gross_cents)} />
        <Metric label="Est. local impact" value={fmtMoney(data.impact.economic_impact_cents)} accent />
      </div>
      <p className="mb-3 text-xs text-white/40">
        Economic-impact estimate (entries × ~$340 avg spend) — drop this into a Right-to-Race brief for local officials.
      </p>
      {data.registrations.length === 0 ? (
        <p className="text-sm text-white/40">No registrations yet.</p>
      ) : (
        <div className="space-y-1.5">
          {data.registrations.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-carbon-900/60 px-3 py-2 text-sm">
              <span className="font-medium text-white">{r.rider_name}</span>
              <span className="text-white/45">{r.race_class || "—"}</span>
              <Badge tone={r.status === "confirmed" ? "green" : "muted"}>{r.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-carbon-900/60 p-3 text-center">
      <div className={`font-display text-xl font-extrabold ${accent ? "text-ignition" : "text-white"}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
    </div>
  );
}
