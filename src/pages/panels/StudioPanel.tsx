import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Badge, EmptyState, Spinner } from "../../components/ui";
import { useToast } from "../../state/toast";

const KINDS = [
  { id: "social", label: "Social posts", hint: "3 shareable posts" },
  { id: "event_promo", label: "Event promo", hint: "Hook + body" },
  { id: "sponsor_thanks", label: "Sponsor thank-you", hint: "Public shout-out" },
  { id: "recap", label: "Race recap", hint: "Celebrate the weekend" },
  { id: "press", label: "Press blurb", hint: "For local press" },
] as const;

export default function StudioPanel() {
  const toast = useToast();
  const [kind, setKind] = useState<string>("social");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [hashtags, setHashtags] = useState(false);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [assets, setAssets] = useState<any[]>([]);

  function loadAssets() {
    api.studioAssets().then((r) => setAssets(r.assets)).catch(() => {});
  }
  useEffect(loadAssets, []);

  async function generate() {
    if (!subject.trim()) {
      toast.error("Tell the studio who or what this is about.");
      return;
    }
    setBusy(true);
    setOutput("");
    try {
      const r = await api.studioGenerate({ kind, subject, details, withHashtags: hashtags });
      setOutput(r.body);
    } catch (e: any) {
      toast.error(e?.message || "Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!output.trim()) return;
    await api.studioSave({ kind, title: subject.slice(0, 80), body: output });
    toast.success("Saved to your library.");
    loadAssets();
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Copied to clipboard."),
      () => toast.error("Couldn't copy."),
    );
  }

  async function remove(id: string) {
    setAssets((p) => p.filter((a) => a.id !== id));
    await api.studioDelete(id).catch(loadAssets);
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Badge tone="live">✨ AI Marketing Studio</Badge>
        </div>
        <p className="mt-2 text-sm text-white/55">
          Turn your season into shareable marketing in seconds. Pick a type, add a few details, and
          let inmotu write it in the voice of the paddock.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Generator */}
        <div className="panel p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  kind === k.id
                    ? "border-ignition/50 bg-ignition/15 text-ignition-300"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <label className="label">Who / what is this about?</label>
          <input
            className="field"
            placeholder="e.g. Cole Darling, #42, 85cc"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <label className="label mt-3">Details to include (optional)</label>
          <textarea
            className="field h-24 resize-none"
            placeholder="e.g. Won the North Central Area Qualifier, advancing to Regionals at Spring Creek. Thanks to Midwest Powersports."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <label className="mt-3 flex items-center gap-2 text-sm text-white/60">
            <input type="checkbox" checked={hashtags} onChange={(e) => setHashtags(e.target.checked)} />
            Include hashtags
          </label>
          <button className="btn-primary mt-4 w-full" onClick={generate} disabled={busy}>
            {busy ? "Writing…" : "✨ Generate"}
          </button>
        </div>

        {/* Output */}
        <div className="panel flex flex-col p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-bold uppercase tracking-wide text-white/50">
              Draft
            </span>
            {output && (
              <div className="flex gap-2">
                <button className="btn-ghost btn-sm" onClick={() => copy(output)}>Copy</button>
                <button className="btn-primary btn-sm" onClick={save}>Save</button>
              </div>
            )}
          </div>
          {busy ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <Spinner className="h-7 w-7" />
            </div>
          ) : output ? (
            <pre className="flex-1 whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/85">
              {output}
            </pre>
          ) : (
            <div className="flex flex-1 items-center justify-center py-10 text-center text-sm text-white/35">
              Your generated copy will appear here.
            </div>
          )}
        </div>
      </div>

      {/* Library */}
      <div className="mt-8">
        <h3 className="mb-3 font-display text-lg font-bold">Your library</h3>
        {assets.length === 0 ? (
          <EmptyState title="Nothing saved yet" hint="Generate something and hit Save to keep it here." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {assets.map((a) => (
              <div key={a.id} className="panel p-4">
                <div className="mb-1 flex items-center justify-between">
                  <Badge tone="muted">{a.kind.replace("_", " ")}</Badge>
                  <div className="flex gap-2">
                    <button className="text-xs text-white/40 hover:text-white" onClick={() => copy(a.body)}>Copy</button>
                    <button className="text-xs text-white/30 hover:text-flag-red" onClick={() => remove(a.id)}>✕</button>
                  </div>
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap text-sm text-white/70">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
