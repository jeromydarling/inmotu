import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { AuthShell } from "./Login";

export default function Register() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", zip: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function up(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { user } = await api.register(form);
      api.trackEvent("signup");
      setUser(user);
      nav("/app");
    } catch (e: any) {
      setErr(e.message || "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Find your people" subtitle="The Grid and the Frontline are free forever. No card, no catch — just pull in.">
      <form onSubmit={submit} className="space-y-4">
        {err && (
          <div className="rounded-xl border border-flag-red/30 bg-flag-red/10 px-3.5 py-2.5 text-sm text-flag-red">
            {err}
          </div>
        )}
        <div>
          <label className="label">Full name</label>
          <input
            className="field"
            name="full_name"
            value={form.full_name}
            onChange={(e) => up("full_name", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            className="field"
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => up("email", e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-[1fr_0.6fr] gap-3">
          <div>
            <label className="label">Password</label>
            <input
              className="field"
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              value={form.password}
              onChange={(e) => up("password", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">ZIP</label>
            <input
              className="field"
              name="zip"
              value={form.zip}
              onChange={(e) => up("zip", e.target.value)}
              placeholder="55044"
            />
          </div>
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating…" : "Create free account"}
        </button>
        <p className="text-center text-xs text-white/35">
          Min 8 characters. We use your ZIP to surface nearby events &amp; your Right-to-Race
          district.
        </p>
      </form>
      <p className="mt-5 text-center text-sm text-white/45">
        Already racing with us?{" "}
        <Link to="/login" className="font-semibold text-ignition">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
