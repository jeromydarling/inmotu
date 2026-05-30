import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Track } from "@shared/types";
import { Badge, Spinner } from "../components/ui";
import { fmtDate, titleCase } from "../lib/format";

export default function TrackDetail() {
  const { slug } = useParams();
  const [data, setData] = useState<{ track: Track; events: any[]; threats: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    api
      .track(slug)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  if (!data)
    return (
      <div className="container-page py-24 text-center text-white/50">
        Track not found. <Link to="/tracks" className="text-ignition">All tracks</Link>
      </div>
    );

  const { track: t, events, threats } = data;

  return (
    <div className="container-page py-12">
      <Link to="/tracks" className="text-sm text-white/40 hover:text-white">
        ← All tracks
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone="amber">{titleCase(t.discipline || "")}</Badge>
        <Badge tone="muted">{titleCase(t.surface || "")}</Badge>
        {t.status === "endangered" && <Badge tone="red">⚠ Endangered</Badge>}
      </div>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tightest">{t.name}</h1>
      <p className="mt-1 text-lg text-white/55">
        {t.city}, {t.state}
      </p>

      {threats.length > 0 && (
        <div className="mt-6 rounded-2xl border border-flag-red/30 bg-flag-red/[0.07] p-6">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <h2 className="font-display text-lg font-bold text-flag-red">This track is under threat</h2>
          </div>
          {threats.map((th) => (
            <div key={th.id} className="mt-2">
              <Badge tone="red">{titleCase(th.threat_type)}</Badge>
              <p className="mt-2 text-sm text-white/65">{th.description}</p>
            </div>
          ))}
          <Link to="/frontline" className="btn-primary mt-4">
            Take action on the Frontline →
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <h2 className="mb-3 font-display text-xl font-bold">Upcoming events</h2>
          {events.length === 0 ? (
            <p className="text-sm text-white/40">No events scheduled yet.</p>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <Link
                  key={e.id}
                  to={`/events/${e.slug}`}
                  className="panel flex items-center justify-between p-4 transition hover:border-ignition/30"
                >
                  <div>
                    <div className="font-semibold text-white">{e.title}</div>
                    <div className="text-sm text-white/45">{fmtDate(e.starts_at)}</div>
                  </div>
                  <Badge tone="muted">{titleCase(e.level || "")}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside>
          <div className="panel p-6">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white/50">
              Amenities
            </h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.amenities.length ? (
                t.amenities.map((a) => (
                  <span key={a} className="chip">
                    {titleCase(a)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-white/40">—</span>
              )}
            </div>
            {t.website && (
              <a
                href={t.website}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost mt-5 w-full"
              >
                Visit website ↗
              </a>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
