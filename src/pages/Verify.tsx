import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { AuthShell } from "./Login";

type State = "verifying" | "ok" | "error";

export default function Verify() {
  const { setUser } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("verifying");
  const [msg, setMsg] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard React 18 StrictMode double-invoke
    ran.current = true;
    if (!token) {
      setState("error");
      setMsg("This confirmation link is missing its token.");
      return;
    }
    api
      .verifyEmail(token)
      .then(({ user }) => {
        setUser(user);
        setState("ok");
      })
      .catch((e: any) => {
        setState("error");
        setMsg(e.message || "This confirmation link is invalid or has expired.");
      });
  }, [token, setUser]);

  if (state === "verifying") {
    return <AuthShell title="Confirming your email…" subtitle="One moment." children={null} />;
  }

  if (state === "ok") {
    return (
      <AuthShell title="Email confirmed 🏁" subtitle="You're all set.">
        <p className="text-sm text-white/60">
          Thanks — your email is verified. You'll now get deadline reminders for the races you save.
        </p>
        <p className="mt-5 text-center text-sm">
          <Link to="/app" className="btn-primary inline-block">
            Open my paddock →
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Couldn't confirm your email" subtitle={msg}>
      <p className="text-sm text-white/60">
        The link may have expired. Sign in and request a fresh confirmation email from your settings.
      </p>
      <p className="mt-5 text-center text-sm text-white/45">
        <Link to="/login" className="font-semibold text-ignition">
          Go to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
