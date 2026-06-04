import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { AuthShell } from "./Login";

export default function ResetPassword() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <AuthShell title="Invalid link" subtitle="This password reset link is missing or malformed.">
        <p className="text-sm text-white/60">
          Request a fresh one from the{" "}
          <Link to="/forgot-password" className="font-semibold text-ignition">
            forgot password
          </Link>{" "}
          page.
        </p>
      </AuthShell>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { user } = await api.resetPassword(token, password);
      setUser(user);
      nav("/app");
    } catch (e: any) {
      setErr(e.message || "Couldn't reset your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a new password for your inmotu account.">
      <form onSubmit={submit} className="space-y-4">
        {err && (
          <div className="rounded-xl border border-flag-red/30 bg-flag-red/10 px-3.5 py-2.5 text-sm text-flag-red">
            {err}
          </div>
        )}
        <div>
          <label className="label">New password</label>
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="label">Confirm password</label>
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Reset password"}
        </button>
      </form>
    </AuthShell>
  );
}
