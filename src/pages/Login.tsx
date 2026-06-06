import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { Mark } from "../components/Logo";

export default function Login() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { user } = await api.login(email, password);
      setUser(user);
      nav((loc.state as any)?.from ?? "/app");
    } catch (e: any) {
      setErr(e.message || "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your inmotu account.">
      <form onSubmit={submit} className="space-y-4">
        {err && (
          <div className="rounded-xl border border-flag-red/30 bg-flag-red/10 px-3.5 py-2.5 text-sm text-flag-red">
            {err}
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input
            className="field"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label">Password</label>
            <Link to="/forgot-password" className="text-xs font-semibold text-ignition">
              Forgot password?
            </Link>
          </div>
          <input
            className="field"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-white/45">
        New here?{" "}
        <Link to="/register" className="font-semibold text-ignition">
          Create a free account
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-page flex min-h-[80vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <Mark className="h-9 w-9" />
          <span className="font-display text-2xl font-extrabold">
            in<span className="text-ignition">motu</span>
          </span>
        </Link>
        <div className="panel p-8">
          <h1 className="font-display text-2xl font-extrabold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-white/50">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
