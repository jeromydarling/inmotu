import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Badge, EmptyState, Spinner, Pill } from "../components/ui";
import { Reveal } from "../components/motion";
import { titleCase } from "../lib/format";
import { useTranslate } from "../state/translation";

const catTone: Record<string, any> = {
  classes: "live",
  advancement: "amber",
  safety: "green",
  conduct: "muted",
};

export default function Rules() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    const p: Record<string, string> = {};
    if (cat) p.category = cat;
    if (q) p.q = q;
    const t = setTimeout(() => {
      api.rules(p).then((r) => setRules(r.rules)).finally(() => setLoading(false));
    }, q ? 200 : 0);
    return () => clearTimeout(t);
  }, [cat, q]);

  // Batch-translate every rule's title + summary in one call (cached server-side).
  const texts = useMemo(() => rules.flatMap((r) => [r.title ?? "", r.summary ?? ""]), [rules]);
  const translated = useTranslate(texts);
  const tr = useMemo(() => {
    const m = new Map<string, string>();
    texts.forEach((t, i) => m.set(t, translated[i]));
    return (s: string) => m.get(s) ?? s;
  }, [texts, translated]);

  const cats = ["classes", "advancement", "safety", "conduct"];
  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of rules) (m.get(r.category) ?? m.set(r.category, []).get(r.category)!).push(r);
    return [...m.entries()];
  }, [rules]);

  return (
    <div className="container-page py-12">
      <header className="mb-8">
        <p className="eyebrow">Rules library</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest">Know the rules. Race with confidence.</h1>
        <p className="mt-2 max-w-2xl text-white/55">
          Plain-language summaries of class structures, advancement, safety, and conduct — so the
          newest family in the pits is never guessing.
        </p>
      </header>

      <div className="panel mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input className="field sm:max-w-xs" placeholder="Search rules…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Pill active={!cat} onClick={() => setCat("")}>All</Pill>
          {cats.map((cc) => <Pill key={cc} active={cat === cc} onClick={() => setCat(cat === cc ? "" : cc)}>{titleCase(cc)}</Pill>)}
        </div>
      </div>

      {loading ? (
        <Spinner className="mx-auto h-8 w-8" />
      ) : rules.length === 0 ? (
        <EmptyState title="No rules match" />
      ) : (
        <div className="space-y-10">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-white/40">{titleCase(category)}</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {items.map((r, i) => (
                  <Reveal key={r.id} delay={(i % 2) * 70}>
                    <div className="panel h-full p-5">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge tone={catTone[r.category] ?? "muted"}>{r.category}</Badge>
                        {r.discipline && <Badge tone="muted">{titleCase(r.discipline)}</Badge>}
                      </div>
                      <h3 className="font-display text-lg font-bold text-white">{tr(r.title)}</h3>
                      <p className="mt-2 text-sm text-white/55">{tr(r.summary)}</p>
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-ignition">
                          Official source ↗
                        </a>
                      )}
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
