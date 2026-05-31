import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ImportModal } from "./ImportModal";
import { SectorPicker } from "./SectorPicker";
import { useAuth } from "../state/auth";
import type { SectorId } from "@shared/types";

const STEP_LABELS: Record<string, { label: string; hint: string }> = {
  addRider: { label: "Add a rider", hint: "Riders tab → + Add rider" },
  saveEvent: { label: "Save a race", hint: "Browse The Grid and tap Save" },
  addPhoto: { label: "Add a photo", hint: "Photos tab → + Add photos" },
  microsite: { label: "Build your microsite", hint: "Microsite tab" },
};

/**
 * First-login welcome + progress checklist. Hides itself once every step is
 * complete (or the user dismisses it for the session).
 */
export function OnboardingChecklist({ firstName }: { firstName?: string }) {
  const { user, refresh } = useAuth();
  const [status, setStatus] = useState<{ steps: Record<string, boolean>; done: number; total: number } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [picking, setPicking] = useState<SectorId[]>([]);
  const [savingSectors, setSavingSectors] = useState(false);
  const [dismissed, setDismissed] = useState(
    typeof sessionStorage !== "undefined" && sessionStorage.getItem("imt_onboard_dismissed") === "1",
  );

  function load() {
    api.onboardingStatus().then(setStatus).catch(() => {});
  }
  useEffect(load, []);

  // First gate: pick your sector(s) before anything else. Adapts the whole app.
  const needsSector = !!user && (user.sectors?.length ?? 0) === 0;
  if (needsSector && !dismissed) {
    async function saveSectors() {
      if (picking.length === 0) return;
      setSavingSectors(true);
      try {
        await api.setSectors(picking);
        await refresh();
      } finally {
        setSavingSectors(false);
      }
    }
    return (
      <div className="panel relative mb-8 overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-ignition/10 blur-3xl" />
        <div className="relative">
          <p className="eyebrow">Welcome{firstName ? `, ${firstName}` : ""} 🏁</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tightest">
            What do you race?
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Pick your world (or worlds) — we'll tune inmotu to speak your language: your races, your
            ladder, your tracks. You can change this anytime.
          </p>
          <div className="mt-5">
            <SectorPicker value={picking} onChange={setPicking} />
          </div>
          <button className="btn-primary mt-5" disabled={picking.length === 0 || savingSectors} onClick={saveSectors}>
            {savingSectors ? "Saving…" : "That's my paddock →"}
          </button>
        </div>
      </div>
    );
  }

  if (!status || dismissed) return null;
  if (status.done >= status.total) return null; // fully onboarded — hide

  const pct = Math.round((status.done / status.total) * 100);

  return (
    <>
      <div className="panel relative mb-8 overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-ignition/10 blur-3xl" />
        <button
          onClick={() => {
            setDismissed(true);
            sessionStorage.setItem("imt_onboard_dismissed", "1");
          }}
          className="absolute right-4 top-4 text-white/30 hover:text-white"
          aria-label="Dismiss"
        >
          ✕
        </button>
        <div className="relative">
          <p className="eyebrow">Welcome{firstName ? `, ${firstName}` : ""} 🏁</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tightest">Let's get your paddock set up</h2>
          <p className="mt-1 text-sm text-white/55">A few quick steps — or skip the typing and import your season with AI.</p>

          {/* progress bar */}
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-ignition to-amber transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-white/50">{status.done}/{status.total}</span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(status.steps).map(([key, done]) => {
              const meta = STEP_LABELS[key];
              if (!meta) return null;
              return (
                <div key={key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${done ? "border-flag-green/25 bg-flag-green/[0.06]" : "border-white/[0.06] bg-carbon-850"}`}>
                  <span className={done ? "text-flag-green" : "text-white/30"}>{done ? "✓" : "○"}</span>
                  <span className={done ? "text-white/50 line-through" : "text-white/80"}>{meta.label}</span>
                  {!done && <span className="ml-auto text-[11px] text-white/35">{meta.hint}</span>}
                </div>
              );
            })}
          </div>

          <button className="btn-primary mt-5" onClick={() => setShowImport(true)}>
            ✨ Import my season with AI
          </button>
        </div>
      </div>
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={load} />}
    </>
  );
}
