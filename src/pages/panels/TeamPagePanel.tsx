import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Badge, Spinner } from "../../components/ui";
import { useToast } from "../../state/toast";

const HEROES = ["paddock", "mx", "car", "start", "hero"];

export default function TeamPagePanel() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [f, setF] = useState({
    name: "",
    tagline: "",
    bio: "",
    hometown: "",
    discipline: "motocross",
    hero_slug: "paddock",
    published: false,
  });

  useEffect(() => {
    api
      .myTeamPage()
      .then((r) => {
        if (r.page) {
          setSlug(r.page.slug);
          setF({
            name: r.page.name ?? "",
            tagline: r.page.tagline ?? "",
            bio: r.page.bio ?? "",
            hometown: r.page.hometown ?? "",
            discipline: r.page.discipline ?? "motocross",
            hero_slug: r.page.hero_slug ?? "paddock",
            published: !!r.page.published,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function aiFill() {
    if (!f.name.trim()) {
      toast.error("Add a team/family name first.");
      return;
    }
    setAiBusy(true);
    try {
      const facts = `Hometown: ${f.hometown || "n/a"}. Discipline: ${f.discipline}.`;
      const { tagline, bio } = await api.aiBio(f.name, facts);
      setF((p) => ({ ...p, tagline: tagline || p.tagline, bio: bio || p.bio }));
      toast.success("Drafted with AI — tweak as you like.");
    } catch (e: any) {
      toast.error(e?.message || "AI couldn't draft that. Try again.");
    } finally {
      setAiBusy(false);
    }
  }

  async function save(publish?: boolean) {
    if (!f.name.trim()) {
      toast.error("A name is required.");
      return;
    }
    setSaving(true);
    try {
      const r = await api.saveTeamPage({ ...f, published: publish ?? f.published });
      setSlug(r.page.slug);
      setF((p) => ({ ...p, published: !!r.page.published }));
      toast.success(publish ? "Your page is live!" : "Saved.");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner className="mx-auto h-8 w-8" />;

  const publicUrl = slug ? `${window.location.origin}/t/${slug}` : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="panel p-5">
        <div className="mb-3 flex items-center gap-2">
          <Badge tone="live">🌐 Your microsite</Badge>
          {f.published && slug && <Badge tone="green">Live</Badge>}
        </div>
        <label className="label">Team / family name</label>
        <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Darling Racing" />

        <div className="mt-3 flex items-center justify-between">
          <label className="label mb-0">Tagline & bio</label>
          <button className="btn-ghost btn-sm" onClick={aiFill} disabled={aiBusy}>
            {aiBusy ? "Drafting…" : "✨ Draft with AI"}
          </button>
        </div>
        <input className="field mt-1" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} placeholder="Tagline" />
        <textarea className="field mt-2 h-24 resize-none" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="A couple sentences about your team…" />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Hometown</label>
            <input className="field" value={f.hometown} onChange={(e) => setF({ ...f, hometown: e.target.value })} placeholder="Millville, MN" />
          </div>
          <div>
            <label className="label">Discipline</label>
            <select className="field" value={f.discipline} onChange={(e) => setF({ ...f, discipline: e.target.value })}>
              {["motocross", "road-race", "autocross", "endurance", "short-track", "karting"].map((d) => (
                <option key={d} value={d} className="bg-carbon-900">{d}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="label mt-3">Hero image</label>
        <div className="flex flex-wrap gap-2">
          {HEROES.map((h) => (
            <button
              key={h}
              onClick={() => setF({ ...f, hero_slug: h })}
              className={`h-12 w-16 overflow-hidden rounded-lg border-2 transition ${
                f.hero_slug === h ? "border-ignition" : "border-white/10"
              }`}
            >
              <img src={`/api/img/${h}`} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => save(false)} disabled={saving}>
            Save draft
          </button>
          <button className="btn-primary flex-1" onClick={() => save(true)} disabled={saving}>
            {f.published ? "Update live page" : "Publish"}
          </button>
        </div>
      </div>

      {/* Preview + share */}
      <div>
        <div className="panel overflow-hidden">
          <div className="relative h-32">
            <img src={`/api/img/${f.hero_slug}`} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-carbon-950 to-transparent" />
            <div className="absolute bottom-3 left-4">
              <div className="font-display text-xl font-extrabold">{f.name || "Your team"}</div>
              <div className="text-xs text-ignition-300">{f.tagline || "Your tagline"}</div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-white/60">{f.bio || "Your bio will appear here."}</p>
            {f.hometown && <p className="mt-2 text-xs text-white/40">📍 {f.hometown}</p>}
          </div>
        </div>

        {publicUrl && (
          <div className="panel mt-3 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/40">Share link</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-carbon-900 px-2 py-1.5 text-xs text-ignition-300">{publicUrl}</code>
              <button
                className="btn-ghost btn-sm"
                onClick={() => navigator.clipboard?.writeText(publicUrl).then(() => toast.success("Link copied."))}
              >
                Copy
              </button>
            </div>
            {!f.published && <p className="mt-2 text-xs text-amber-400">Publish to make this link public.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
