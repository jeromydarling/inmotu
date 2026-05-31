import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Legislation } from "@shared/types";
import { Badge, Spinner } from "../components/ui";
import { MapView, type MapPoint } from "../components/MapView";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

const statusMeta: Record<string, { tone: any; label: string; pct: number }> = {
  enacted: { tone: "green", label: "Enacted", pct: 100 },
  passed: { tone: "amber", label: "Passed chamber", pct: 70 },
  committee: { tone: "amber", label: "In committee", pct: 45 },
  introduced: { tone: "default", label: "Introduced", pct: 20 },
  failed: { tone: "red", label: "Failed", pct: 0 },
};

export default function Frontline() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [bills, setBills] = useState<Legislation[]>([]);
  const [endangered, setEndangered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Legislator lookup by ZIP (Google Civic, cached server-side).
  const [zip, setZip] = useState(user?.zip ?? "");
  const [officials, setOfficials] = useState<any[] | null>(null);
  const [repState, setRepState] = useState<string | null>(null);
  const [repBusy, setRepBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.legislation(), api.endangered()])
      .then(([l, e]) => {
        setBills(l.legislation);
        setEndangered(e.tracks);
      })
      .catch(() => toast.error("Couldn't load the bill tracker. Refresh to retry."))
      .finally(() => setLoading(false));
  }, []);

  async function findReps() {
    if (!/^\d{5}$/.test(zip)) return toast.error("Enter a 5-digit ZIP.");
    setRepBusy(true);
    try {
      const r = await api.legislators(zip);
      if (!r.configured) {
        toast.error("Legislator lookup activates once the Civic API key is set.");
        setOfficials([]);
      } else {
        setOfficials(r.officials);
        setRepState(r.state);
        if (r.officials.length === 0) toast.error("No state legislators found for that ZIP.");
      }
    } catch {
      toast.error("Lookup failed. Try again.");
    } finally {
      setRepBusy(false);
    }
  }

  async function pledge(b: Legislation) {
    if (!user) {
      nav("/login", { state: { from: "/frontline" } });
      return;
    }
    if (b.supported) return;
    const snapshot = bills;
    setBills((prev) =>
      prev.map((x) =>
        x.id === b.id ? { ...x, supported: true, supporters: (x.supporters ?? 0) + 1 } : x,
      ),
    );
    try {
      await api.support("pledge", "legislation", b.id);
    } catch {
      setBills(snapshot); // roll back on failure
      toast.error("Couldn't record your pledge. Try again.");
    }
  }

  function contactRep(b: Legislation, official?: any) {
    const greeting = official ? `Dear ${official.name},` : "Dear Representative,";
    const to = official?.emails?.[0] ?? "";
    const subject = encodeURIComponent(`Support ${b.bill_number ?? "the Right to Race bill"} in ${b.state_name}`);
    const body = encodeURIComponent(
      `${greeting}\n\nI'm a constituent and a member of the motorsports community. I'm writing to urge your support for ${b.bill_number ?? "Right to Race legislation"} — ${b.title}.\n\nLocal racetracks are vital economic and community hubs that often predate the neighbors now seeking to shut them down. "Coming to the nuisance" protections like this bill keep these family-run facilities alive.\n\nPlease support ${b.bill_number ?? "this bill"}.\n\nThank you,\n[Your name]\n[Your address]`,
    );
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  const enacted = bills.filter((b) => b.status === "enacted").length;
  const active = bills.filter((b) => ["introduced", "committee", "passed"].includes(b.status)).length;

  return (
    <div className="container-page py-12">
      <header className="mb-8">
        <p className="eyebrow">Module 05 · The Frontline</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest">
          Right to Race. Right now.
        </h1>
        <p className="mt-2 max-w-2xl text-white/55">
          The tracks where we gather have anchored their towns for generations. Track every Right
          to Race bill, add your name, and reach your representative in one tap. Free forever —
          because no track, and no family, should have to stand alone.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="panel px-5 py-3">
            <span className="font-display text-2xl font-extrabold text-flag-green">{enacted}</span>
            <span className="ml-2 text-sm text-white/50">laws enacted</span>
          </div>
          <div className="panel px-5 py-3">
            <span className="font-display text-2xl font-extrabold text-amber">{active}</span>
            <span className="ml-2 text-sm text-white/50">bills active in 2026</span>
          </div>
        </div>
      </header>

      {/* Find my legislators (by ZIP) */}
      <div className="panel mb-8 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Find your state legislators</label>
            <div className="flex gap-2">
              <input
                className="field w-32"
                placeholder="ZIP code"
                value={zip}
                maxLength={5}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
              />
              <button className="btn-primary" onClick={findReps} disabled={repBusy}>
                {repBusy ? "Looking…" : "Find my reps"}
              </button>
            </div>
          </div>
          <p className="flex-1 text-xs text-white/40">
            We'll look up the state lawmakers who represent you, so your message goes to the right
            inbox.
          </p>
        </div>
        {officials && officials.length > 0 && (
          <div className="mt-4">
            {repState && <p className="mb-2 text-xs text-white/40">Your {repState} state legislators:</p>}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {officials.map((o, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-carbon-850 p-3">
                <div className="font-semibold text-white">{o.name}</div>
                <div className="text-xs text-white/45">{o.office}{o.party ? ` · ${o.party}` : ""}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {o.emails?.[0] && (
                    <a href={`mailto:${o.emails[0]}`} className="text-ignition-300">Email</a>
                  )}
                  {o.phones?.[0] && <a href={`tel:${o.phones[0]}`} className="text-white/60">Call</a>}
                  {o.url && <a href={o.url} target="_blank" rel="noreferrer" className="text-white/60">Profile ↗</a>}
                </div>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {bills.map((b) => {
              const m = statusMeta[b.status];
              return (
                <div key={b.id} className="panel p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xl font-extrabold text-white">
                          {b.state_name}
                        </span>
                        {b.bill_number && (
                          <span className="font-mono text-xs text-white/40">{b.bill_number}</span>
                        )}
                        {(b as any).live && (
                          <span className="rounded-full border border-flag-green/30 bg-flag-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-flag-green">
                            ● Live
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-white/55">{b.title}</p>
                    </div>
                    <Badge tone={m.tone}>{m.label}</Badge>
                  </div>

                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full ${
                        b.status === "enacted"
                          ? "bg-flag-green"
                          : b.status === "failed"
                            ? "bg-flag-red"
                            : "bg-amber"
                      }`}
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>

                  {b.summary && <p className="mt-3 text-sm text-white/45">{b.summary}</p>}

                  {Array.isArray((b as any).citations) && (b as any).citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/40">
                      <span className="text-white/30">Sources:</span>
                      {(b as any).citations.slice(0, 3).map((c: any, i: number) => (
                        <a key={i} href={c.url} target="_blank" rel="noreferrer" className="text-ignition-300 hover:underline">
                          {hostname(c.url)}
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => pledge(b)}
                      disabled={b.supported}
                      className={b.supported ? "btn-ghost btn-sm" : "btn-primary btn-sm"}
                    >
                      {b.supported ? "✓ Pledged" : "Pledge support"}
                    </button>
                    {b.status !== "enacted" && b.status !== "failed" && (
                      <button onClick={() => contactRep(b)} className="btn-ghost btn-sm">
                        ✉ Contact rep
                      </button>
                    )}
                    <span className="ml-auto text-xs text-white/40">
                      {b.supporters ?? 0} supporter{(b.supporters ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Endangered tracks */}
          <section className="mt-14">
            <h2 className="mb-1 font-display text-2xl font-extrabold">Endangered tracks</h2>
            <p className="mb-5 text-sm text-white/50">
              Crowdsourced, verified reports of tracks facing development, zoning, or nuisance
              threats. Flag a track to add it to the map.
            </p>
            {endangered.some((t) => t.lat && t.lng) && (
              <div className="mb-6">
                <MapView
                  height={380}
                  points={endangered
                    .filter((t) => t.lat && t.lng)
                    .map<MapPoint>((t) => ({
                      lat: t.lat,
                      lng: t.lng,
                      title: t.name,
                      sub: `${t.city}, ${t.state} · ${t.threat_type ?? "threat"}`,
                      danger: true,
                      href: `/tracks/${t.slug}`,
                    }))}
                />
              </div>
            )}
            {endangered.length === 0 ? (
              <p className="text-sm text-white/40">No endangered tracks reported. 🏁</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {endangered.map((t) => (
                  <div key={t.id} className="panel border-flag-red/20 p-5">
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/tracks/${t.slug}`}
                        className="font-display text-lg font-bold text-white hover:text-ignition-300"
                      >
                        {t.name}
                      </Link>
                      <Badge tone="red">{t.threat_type ?? "threat"}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-white/45">
                      {t.city}, {t.state}
                    </p>
                    {t.description && (
                      <p className="mt-2 text-sm text-white/55">{t.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}
