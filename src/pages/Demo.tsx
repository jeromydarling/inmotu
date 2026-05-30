import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { Mark } from "../components/Logo";
import { Badge } from "../components/ui";

const roles = ["Racing parent", "Racer", "Track operator", "Just curious"];

export default function Demo() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", role: roles[0] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { user } = await api.startDemo(form);
      setUser(user);
      nav("/app");
    } catch (e: any) {
      setErr(e.message || "Could not start the demo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page grid min-h-[80vh] items-center gap-12 py-12 lg:grid-cols-2">
      <div>
        <Badge tone="live">
          <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-ignition" /> Live interactive demo
        </Badge>
        <h1 className="mt-4 font-display text-4xl font-black tracking-tightest sm:text-5xl">
          Step into a fully-loaded season.
        </h1>
        <p className="mt-4 max-w-lg text-white/60">
          We'll drop you into a real inmotu dashboard pre-loaded with two riders, a season budget,
          ladder progress, maintenance history, a sponsor, and a calendar — so you can feel exactly
          what it's like, instantly. No setup.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-white/60">
          {[
            "A family with two motocross riders",
            "Road-to-the-Ranch ladder, two stages cleared",
            "Season budget + maintenance log populated",
            "Sponsor portfolio and saved races",
          ].map((t) => (
            <li key={t} className="flex gap-2"><span className="text-ignition">✓</span>{t}</li>
          ))}
        </ul>
      </div>

      <div className="w-full max-w-md justify-self-center lg:justify-self-end">
        <div className="panel p-8">
          <div className="mb-5 flex items-center gap-2.5">
            <Mark className="h-8 w-8" />
            <span className="font-display text-xl font-extrabold">in<span className="text-ignition">motu</span></span>
          </div>
          <h2 className="font-display text-2xl font-extrabold">Launch your demo</h2>
          <p className="mb-6 mt-1 text-sm text-white/50">Tell us who you are and we'll open the doors.</p>
          <form onSubmit={submit} className="space-y-4">
            {err && <div className="rounded-xl border border-flag-red/30 bg-flag-red/10 px-3.5 py-2.5 text-sm text-flag-red">{err}</div>}
            <div>
              <label className="label">Name</label>
              <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="field" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" />
            </div>
            <div>
              <label className="label">I'm a…</label>
              <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roles.map((r) => <option key={r} value={r} className="bg-carbon-900">{r}</option>)}
              </select>
            </div>
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Loading your paddock…" : "Enter the demo →"}
            </button>
            <p className="text-center text-[11px] text-white/35">
              We'll email you occasional updates. No spam, unsubscribe anytime.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
