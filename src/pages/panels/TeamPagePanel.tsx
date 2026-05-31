import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Badge, Spinner } from "../../components/ui";
import { useToast } from "../../state/toast";

const HEROES = ["paddock", "mx", "car", "start", "hero"];
const ACCENTS = ["#FF4D14", "#FFB800", "#27D17F", "#3B82F6", "#A855F7", "#FF3B4E"];
const SECTION_DEFS: [string, string][] = [
  ["stats", "Season stats"],
  ["riders", "Riders"],
  ["events", "Upcoming races"],
  ["ladder", "Ladder progress"],
  ["photos", "Photo gallery"],
  ["sponsors", "Sponsors / partners"],
  ["video", "Featured video"],
];
const SOCIALS: [string, string][] = [
  ["instagram", "Instagram URL"],
  ["x", "X / Twitter URL"],
  ["youtube", "YouTube URL"],
  ["facebook", "Facebook URL"],
  ["tiktok", "TikTok URL"],
  ["website", "Website URL"],
];

type Sections = Record<string, boolean>;
const DEFAULT_SECTIONS: Sections = {
  stats: true, riders: true, events: true, ladder: false, photos: true, sponsors: false, video: true,
};

export default function TeamPagePanel() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [f, setF] = useState({
    name: "", tagline: "", bio: "", hometown: "", discipline: "motocross",
    hero_slug: "paddock", accent_color: "#FF4D14", featured_video: "", published: false,
  });
  const [sections, setSections] = useState<Sections>(DEFAULT_SECTIONS);
  const [socials, setSocials] = useState<Record<string, string>>({});

  useEffect(() => {
    api.myTeamPage().then((r) => {
      if (r.page) {
        setSlug(r.page.slug);
        setF({
          name: r.page.name ?? "", tagline: r.page.tagline ?? "", bio: r.page.bio ?? "",
          hometown: r.page.hometown ?? "", discipline: r.page.discipline ?? "motocross",
          hero_slug: r.page.hero_slug ?? "paddock", accent_color: r.page.accent_color ?? "#FF4D14",
          featured_video: r.page.featured_video ?? "", published: !!r.page.published,
        });
        if (r.page.sections) setSections({ ...DEFAULT_SECTIONS, ...safeObj(r.page.sections) });
        if (r.page.socials) setSocials(safeObj(r.page.socials));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function aiFill() {
    if (!f.name.trim()) return toast.error("Add a team/family name first.");
    setAiBusy(true);
    try {
      const { tagline, bio } = await api.aiBio(f.name, `Hometown: ${f.hometown || "n/a"}. Discipline: ${f.discipline}.`);
      setF((p) => ({ ...p, tagline: tagline || p.tagline, bio: bio || p.bio }));
      toast.success("Drafted with AI — tweak as you like.");
    } catch (e: any) {
      toast.error(e?.message || "AI couldn't draft that.");
    } finally {
      setAiBusy(false);
    }
  }

  async function save(publish?: boolean) {
    if (!f.name.trim()) return toast.error("A name is required.");
    setSaving(true);
    try {
      const cleanSocials = Object.fromEntries(Object.entries(socials).filter(([, v]) => v?.trim()));
      const r = await api.saveTeamPage({ ...f, sections, socials: cleanSocials, published: publish ?? f.published });
      setSlug(r.page.slug);
      setF((p) => ({ ...p, published: !!r.page.published }));
      toast.success(publish ? "Your page is live!" : "Saved.");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner className="mx-auto h-8 w-8" />;
  const publicUrl = slug ? `${window.location.origin}/t/${slug}` : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="space-y-4">
        {/* Basics */}
        <div className="panel p-5">
          <div className="mb-3 flex items-center gap-2">
            <Badge tone="live">🌐 Your microsite</Badge>
            {f.published && slug && <Badge tone="green">Live</Badge>}
          </div>
          <label className="label">Team / family name</label>
          <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Darling Racing" />
          <div className="mt-3 flex items-center justify-between">
            <label className="label mb-0">Tagline & bio</label>
            <button className="btn-ghost btn-sm" onClick={aiFill} disabled={aiBusy}>{aiBusy ? "Drafting…" : "✨ Draft with AI"}</button>
          </div>
          <input className="field mt-1" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} placeholder="Tagline" />
          <textarea className="field mt-2 h-20 resize-none" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="A couple sentences about your team…" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Hometown</label>
              <input className="field" value={f.hometown} onChange={(e) => setF({ ...f, hometown: e.target.value })} placeholder="Millville, MN" />
            </div>
            <div>
              <label className="label">Discipline</label>
              <select className="field" value={f.discipline} onChange={(e) => setF({ ...f, discipline: e.target.value })}>
                {["motocross", "road-race", "autocross", "endurance", "short-track", "karting"].map((d) => <option key={d} value={d} className="bg-carbon-900">{d}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="panel p-5">
          <label className="label">Brand color</label>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => setF({ ...f, accent_color: c })} aria-label={c}
                className={`h-8 w-8 rounded-full border-2 transition ${f.accent_color === c ? "border-white scale-110" : "border-white/20"}`}
                style={{ background: c }} />
            ))}
            <input type="color" value={f.accent_color} onChange={(e) => setF({ ...f, accent_color: e.target.value })} className="h-8 w-8 cursor-pointer rounded-full border-2 border-white/20 bg-transparent" />
          </div>
          <label className="label mt-4">Hero image</label>
          <div className="flex flex-wrap gap-2">
            {HEROES.map((h) => (
              <button key={h} onClick={() => setF({ ...f, hero_slug: h })}
                className={`h-12 w-16 overflow-hidden rounded-lg border-2 transition ${f.hero_slug === h ? "border-ignition" : "border-white/10"}`}>
                <img src={`/api/img/${h}`} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic sections */}
        <div className="panel p-5">
          <label className="label">Show on your page</label>
          <p className="mb-3 text-xs text-white/40">Pulled live from your account — toggle what the public sees.</p>
          <div className="grid grid-cols-2 gap-2">
            {SECTION_DEFS.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-carbon-850 px-3 py-2 text-sm text-white/70">
                <input type="checkbox" checked={!!sections[key]} onChange={(e) => setSections((s) => ({ ...s, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
          {sections.video && (
            <input className="field mt-3" value={f.featured_video} onChange={(e) => setF({ ...f, featured_video: e.target.value })} placeholder="YouTube or Vimeo URL" />
          )}
          {sections.photos && (
            <p className="mt-2 text-xs text-white/40">Mark photos public in the Photos tab to feature them here.</p>
          )}
        </div>

        {/* Socials */}
        <div className="panel p-5">
          <label className="label">Social profiles</label>
          <div className="grid gap-2">
            {SOCIALS.map(([key, ph]) => (
              <input key={key} className="field" value={socials[key] ?? ""} onChange={(e) => setSocials((s) => ({ ...s, [key]: e.target.value }))} placeholder={ph} />
            ))}
          </div>
          <p className="mt-2 text-xs text-white/40">Links show as icons on your page. Live post feeds from X/Instagram are coming soon.</p>
        </div>

        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => save(false)} disabled={saving}>Save draft</button>
          <button className="btn-primary flex-1" onClick={() => save(true)} disabled={saving}>{f.published ? "Update live page" : "Publish"}</button>
        </div>
      </div>

      {/* Preview + share */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="panel overflow-hidden">
          <div className="relative h-32">
            <img src={`/api/img/${f.hero_slug}`} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-carbon-950 to-transparent" />
            <div className="absolute bottom-3 left-4">
              <div className="font-display text-xl font-extrabold">{f.name || "Your team"}</div>
              <div className="text-xs font-semibold" style={{ color: f.accent_color }}>{f.tagline || "Your tagline"}</div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-white/60">{f.bio || "Your bio will appear here."}</p>
            {f.hometown && <p className="mt-2 text-xs text-white/40">📍 {f.hometown}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SECTION_DEFS.filter(([k]) => sections[k]).map(([k, label]) => (
                <span key={k} className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${f.accent_color}22`, color: f.accent_color }}>{label}</span>
              ))}
            </div>
          </div>
        </div>
        {publicUrl && (
          <div className="panel mt-3 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/40">Share link</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-carbon-900 px-2 py-1.5 text-xs" style={{ color: f.accent_color }}>{publicUrl}</code>
              <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(publicUrl).then(() => toast.success("Link copied."))}>Copy</button>
            </div>
            {f.published ? (
              <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm mt-2 w-full">View live page ↗</a>
            ) : (
              <p className="mt-2 text-xs text-amber-400">Publish to make this link public.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function safeObj(s: unknown): Record<string, any> {
  if (s && typeof s === "object") return s as Record<string, any>;
  if (typeof s === "string") { try { return JSON.parse(s); } catch { return {}; } }
  return {};
}
