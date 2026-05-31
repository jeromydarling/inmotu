import { useState } from "react";
import { api } from "../api/client";
import { Spinner } from "./ui";
import { useToast } from "../state/toast";

const SAMPLE = `Spring Creek MX — Area Qualifier, June 6, Millville MN
Cole Darling #42, 85cc (10-12)
Mara Tran #17, Supermini`;

/**
 * AI-assisted import. Paste a schedule, roster, Facebook event, or email →
 * Workers AI extracts riders + events → user reviews → commit.
 */
export function ImportModal({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [stage, setStage] = useState<"input" | "review">("input");
  const [busy, setBusy] = useState(false);
  const [riders, setRiders] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  async function parse() {
    if (text.trim().length < 10) return toast.error("Paste a bit more to import.");
    setBusy(true);
    try {
      const r = await api.importParse(text);
      if (r.riders.length === 0 && r.events.length === 0) {
        toast.error(r.note || "Couldn't find anything to import.");
      } else {
        setRiders(r.riders.map((x) => ({ ...x, _keep: true })));
        setEvents(r.events.map((x) => ({ ...x, _keep: true })));
        setStage("review");
      }
    } catch (e: any) {
      toast.error(e?.message || "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    const keepR = riders.filter((r) => r._keep);
    const keepE = events.filter((e) => e._keep);
    if (keepR.length === 0 && keepE.length === 0) return toast.error("Select at least one item.");
    setBusy(true);
    try {
      const r = await api.importCommit(keepR, keepE);
      toast.success(`Imported ${r.ridersAdded} rider${r.ridersAdded === 1 ? "" : "s"} and ${r.eventsAdded} event${r.eventsAdded === 1 ? "" : "s"}.`);
      onDone?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save the import.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-carbon-950/80 p-4 backdrop-blur" onClick={onClose}>
      <div className="panel max-h-[88vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="eyebrow">✨ AI Import</p>
            <h2 className="font-display text-2xl font-extrabold tracking-tightest">Bring your season in seconds</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Close">✕</button>
        </div>

        {stage === "input" ? (
          <>
            <p className="mb-3 text-sm text-white/55">
              Paste a schedule, a roster, a Facebook event, or a forwarded email. We'll pull out your
              riders and races so you don't have to type them.
            </p>
            <textarea
              className="field h-48 resize-none font-mono text-xs"
              placeholder={SAMPLE}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="mt-2 flex items-center justify-between">
              <button className="text-xs text-white/40 hover:text-white" onClick={() => setText(SAMPLE)}>
                Use sample text
              </button>
              <button className="btn-primary" onClick={parse} disabled={busy}>
                {busy ? "Reading…" : "✨ Extract"}
              </button>
            </div>
            {busy && <div className="mt-4 flex justify-center"><Spinner className="h-6 w-6" /></div>}
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-white/55">Review what we found, untick anything you don't want, then import.</p>
            {riders.length > 0 && (
              <section className="mb-4">
                <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-white/50">Riders ({riders.length})</h3>
                <div className="space-y-2">
                  {riders.map((r, i) => (
                    <label key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-carbon-850 p-3">
                      <input type="checkbox" checked={r._keep} onChange={(e) => setRiders((p) => p.map((x, j) => (j === i ? { ...x, _keep: e.target.checked } : x)))} />
                      <span className="font-semibold text-white">{r.name}</span>
                      {r.number && <span className="text-xs text-ignition-300">#{r.number}</span>}
                      {r.race_class && <span className="text-xs text-white/45">{r.race_class}</span>}
                    </label>
                  ))}
                </div>
              </section>
            )}
            {events.length > 0 && (
              <section className="mb-4">
                <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-white/50">Events ({events.length})</h3>
                <div className="space-y-2">
                  {events.map((e, i) => (
                    <label key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-carbon-850 p-3">
                      <input type="checkbox" checked={e._keep} onChange={(ev) => setEvents((p) => p.map((x, j) => (j === i ? { ...x, _keep: ev.target.checked } : x)))} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{e.title}</div>
                        <div className="text-xs text-white/45">{[e.date, e.track_name, e.city && e.state ? `${e.city}, ${e.state}` : e.state].filter(Boolean).join(" · ")}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            )}
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setStage("input")}>Back</button>
              <button className="btn-primary flex-1" onClick={commit} disabled={busy}>
                {busy ? "Saving…" : "Import selected"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
