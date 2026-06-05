import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Legislation } from "@shared/types";
import { Badge, Spinner } from "../components/ui";
import { MapView, type MapPoint } from "../components/MapView";
import { STATE_CENTROIDS } from "../lib/states";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import { useTranslate } from "../state/translation";

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

  // Legislator lookup by ZIP. Returns named officials when a provider is
  // configured, otherwise the user's state + an official "find your legislator"
  // link that always works.
  const [zip, setZip] = useState(user?.zip ?? "");
  const [officials, setOfficials] = useState<any[] | null>(null);
  const [repState, setRepState] = useState<string | null>(null);
  const [finderUrl, setFinderUrl] = useState<string | null>(null);
  const [repBusy, setRepBusy] = useState(false);

  // Batch-translate bill titles + summaries (the prose racers actually read).
  const billTexts = useMemo(
    () => bills.flatMap((b) => [b.title ?? "", b.summary ?? ""]),
    [bills],
  );
  const billTr = useTranslate(billTexts);
  const tr = useMemo(() => {
    const m = new Map<string, string>();
    billTexts.forEach((t, i) => m.set(t, billTr[i]));
    return (s: string) => m.get(s) ?? s;
  }, [billTexts, billTr]);

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
      setOfficials(r.officials);
      setRepState(r.state);
      setFinderUrl(r.finderUrl ?? null);
      if (r.officials.length === 0 && !r.finderUrl && !r.state) {
        toast.error("Couldn't resolve that ZIP. Double-check it?");
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

  // Battle map: endangered tracks (precise) + legislation by state (centroid).
  const battlePoints: MapPoint[] = (() => {
    const pts: MapPoint[] = endangered
      .filter((t) => t.lat != null && t.lng != null)
      .map((t) => ({
        lat: t.lat,
        lng: t.lng,
        title: t.name,
        sub: t.threat_type || t.description || "Threatened",
        tone: "red" as const,
        pulse: true,
        href: `/tracks/${t.slug}`,
      }));
    // Aggregate bills by state → one pin per state at its centroid.
    const byState = new Map<string, { name: string; enacted: number; active: number }>();
    for (const b of bills) {
      const code = (b.state || "").toUpperCase();
      if (!STATE_CENTROIDS[code]) continue;
      const cur = byState.get(code) ?? { name: b.state_name || code, enacted: 0, active: 0 };
      if (b.status === "enacted") cur.enacted++;
      else if (["introduced", "committee", "passed"].includes(b.status)) cur.active++;
      byState.set(code, cur);
    }
    for (const [code, s] of byState) {
      const [lat, lng] = STATE_CENTROIDS[code];
      const tone = s.enacted > 0 ? ("green" as const) : s.active > 0 ? ("amber" as const) : ("ignition" as const);
      pts.push({
        lat,
        lng,
        title: s.name,
        sub: s.enacted > 0 ? `${s.enacted} law${s.enacted === 1 ? "" : "s"} enacted` : `${s.active} bill${s.active === 1 ? "" : "s"} active`,
        tone,
      });
    }
    return pts;
  })();

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
        {/* No named officials available — point them to the official state
            "find your legislator" tool (always works, no key needed). */}
        {officials && officials.length === 0 && finderUrl && (
          <div className="mt-4 rounded-xl border border-ignition/20 bg-ignition/[0.06] p-4">
            <p className="text-sm text-white/75">
              {repState ? `You're in ${repState}. ` : ""}Look up your exact state legislators on the
              official finder, then come back to make your voice heard on these bills.
            </p>
            <a href={finderUrl} target="_blank" rel="noreferrer" className="btn-primary btn-sm mt-3">
              Find my {repState ?? "state"} legislators ↗
            </a>
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
                      <p className="mt-0.5 text-sm text-white/55">{tr(b.title)}</p>
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

                  {b.summary && <p className="mt-3 text-sm text-white/45">{tr(b.summary)}</p>}

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
