import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Badge, Spinner } from "../components/ui";
import { useToast } from "../state/toast";
import { enablePush, disablePush, pushSupported } from "../lib/push";
import { useInstallPrompt } from "../lib/useInstallPrompt";

export default function Settings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState({ notify_email: true, notify_push: true, notify_deadlines: true });
  const [vapidConfigured, setVapidConfigured] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const { canInstall, promptInstall, installed } = useInstallPrompt();

  useEffect(() => {
    api.notifyPrefs().then((r) => {
      if (r.prefs)
        setPrefs({
          notify_email: !!r.prefs.notify_email,
          notify_push: !!r.prefs.notify_push,
          notify_deadlines: !!r.prefs.notify_deadlines,
        });
      setVapidConfigured(r.vapidConfigured);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function update(patch: Partial<typeof prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await api.saveNotifyPrefs(next).catch(() => toast.error("Couldn't save preferences."));
  }

  async function togglePush(on: boolean) {
    setPushBusy(true);
    try {
      if (on) {
        const ok = await enablePush();
        if (ok) {
          toast.success("Push notifications enabled on this device.");
          update({ notify_push: true });
        } else {
          toast.error(
            vapidConfigured ? "Permission denied or unsupported." : "Push isn't configured on the server yet.",
          );
        }
      } else {
        await disablePush();
        update({ notify_push: false });
        toast.success("Push disabled on this device.");
      }
    } finally {
      setPushBusy(false);
    }
  }

  if (loading) return <div className="container-page py-20"><Spinner className="mx-auto h-8 w-8" /></div>;

  return (
    <div className="container-page max-w-2xl py-12">
      <header className="mb-8">
        <p className="eyebrow">Settings</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest">Notifications & app</h1>
      </header>

      {/* Install */}
      <div className="panel mb-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Install inmotu</h2>
            <p className="text-sm text-white/55">Add to your home screen for one-tap access and offline calendar.</p>
          </div>
          {installed ? (
            <Badge tone="green">Installed</Badge>
          ) : canInstall ? (
            <button className="btn-primary" onClick={promptInstall}>Install app</button>
          ) : (
            <span className="text-xs text-white/40">Use your browser's “Add to Home Screen”.</span>
          )}
        </div>
      </div>

      {/* Notification prefs */}
      <div className="panel divide-y divide-white/[0.06] p-2">
        <Row
          title="Push notifications"
          desc={
            pushSupported()
              ? "Get alerts on this device — even when inmotu is closed."
              : "This browser doesn't support push notifications."
          }
          checked={prefs.notify_push}
          disabled={!pushSupported() || pushBusy}
          onChange={togglePush}
        />
        <Row
          title="Email notifications"
          desc="Receive important alerts by email."
          checked={prefs.notify_email}
          onChange={(v) => update({ notify_email: v })}
        />
        <Row
          title="Registration deadline reminders"
          desc="We'll remind you before registration closes for saved events."
          checked={prefs.notify_deadlines}
          onChange={(v) => update({ notify_deadlines: v })}
        />
      </div>

      {!vapidConfigured && (
        <p className="mt-4 text-center text-xs text-white/35">
          In-app & email alerts are active now. Browser push activates once server keys are configured.
        </p>
      )}
    </div>
  );
}

function Row({
  title,
  desc,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-center justify-between gap-4 p-4 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <div>
        <div className="font-semibold text-white">{title}</div>
        <div className="text-sm text-white/50">{desc}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-ignition" : "bg-white/15"}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
