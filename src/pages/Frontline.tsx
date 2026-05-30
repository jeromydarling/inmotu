import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Legislation } from "@shared/types";
import { Badge, Spinner } from "../components/ui";
import { useAuth } from "../state/auth";

const statusMeta: Record<string, { tone: any; label: string; pct: number }> = {
  enacted: { tone: "green", label: "Enacted", pct: 100 },
  passed: { tone: "amber", label: "Passed chamber", pct: 70 },
  committee: { tone: "amber", label: "In committee", pct: 45 },
  introduced: { tone: "default", label: "Introduced", pct: 20 },
  failed: { tone: "red", label: "Failed", pct: 0 },
};

export default function Frontline() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Legislation[]>([]);
  const [endangered, setEndangered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.legislation(), api.endangered()])
      .then(([l, e]) => {
        setBills(l.legislation);
        setEndangered(e.tracks);
      })
      .finally(() => setLoading(false));
  }, []);

  async function pledge(b: Legislation) {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setBills((prev) =>
      prev.map((x) =>
        x.id === b.id
          ? { ...x, supported: true, supporters: (x.supporters ?? 0) + (x.supported ? 0 : 1) }
          : x,
      ),
    );
    await api.support("pledge", "legislation", b.id).catch(() => {});
  }

  function contactRep(b: Legislation) {
    const subject = encodeURIComponent(`Support ${b.bill_number ?? "the Right to Race bill"} in ${b.state_name}`);
    const body = encodeURIComponent(
      `Dear Representative,\n\nI'm a constituent and a member of the motorsports community. I'm writing to urge your support for ${b.bill_number ?? "Right to Race legislation"} — ${b.title}.\n\nLocal racetracks are vital economic and community hubs that often predate the neighbors now seeking to shut them down. "Coming to the nuisance" protections like this bill keep these family-run facilities alive.\n\nPlease support ${b.bill_number ?? "this bill"}.\n\nThank you,\n[Your name]\n[Your address]`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
