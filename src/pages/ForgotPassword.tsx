import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { AuthShell } from "./Login";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.forgotPassword(email);
    } catch {
      /* always show success — never reveal whether an email is registered */
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="If that address has an account, a reset link is on its way.">
        <p className="text-sm text-white/60">
          We sent a password reset link to <span className="font-semibold text-white">{email}</span>. It expires in
          1 hour. Don't see it? Check spam, or{" "}
          <button onClick={() => setSent(false)} className="font-semibold text-ignition">
            try again
          </button>
          .
        </p>
        <p className="mt-5 text-center text-sm text-white/45">
          <Link to="/login" className="font-semibold text-ignition">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            className="field"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-white/45">
        <Link to="/login" className="font-semibold text-ignition">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
