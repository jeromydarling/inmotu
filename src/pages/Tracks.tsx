import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Track } from "@shared/types";
import { Badge, Spinner, EmptyState } from "../components/ui";
import { titleCase } from "../lib/format";

export default function Tracks() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "endangered">("all");

  useEffect(() => {
    setLoading(true);
    api
      .tracks(filter === "endangered" ? { status: "endangered" } : {})
      .then((r) => setTracks(r.tracks))
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="container-page py-12">
      <header className="mb-8">
        <p className="eyebrow">Track directory</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest">
          Tracks worth fighting for.
        </h1>
        <p className="mt-2 max-w-2xl text-white/55">
          The places we gather, mapped and remembered — events, surface, amenities, and threat
          status. Tracks under threat are flagged so the community can rally behind them.
        </p>
      </header>

      <div className="mb-6 flex gap-2">
        {(["all", "endangered"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              filter === f
                ? "border-ignition/50 bg-ignition/15 text-ignition-300"
                : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
            }`}
          >
            {f === "all" ? "All tracks" : "⚠ Endangered"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : tracks.length === 0 ? (
        <EmptyState title="No tracks found" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((t) => (
            <Link
              key={t.id}
              to={`/tracks/${t.slug}`}
              className="panel group p-5 transition hover:-translate-y-0.5 hover:border-white/15"
            >
              <div className="mb-2 flex items-center justify-between">
                <Badge tone={t.discipline === "motocross" ? "amber" : "default"}>
                  {titleCase(t.discipline || "")}
                </Badge>
                {t.status === "endangered" && <Badge tone="red">⚠ Endangered</Badge>}
              </div>
              <h3 className="font-display text-xl font-bold text-white group-hover:text-ignition-300">
                {t.name}
              </h3>
              <p className="mt-1 text-sm text-white/50">
                {t.city}, {t.state} · {titleCase(t.surface || "")}
              </p>
              {t.amenities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.amenities.slice(0, 3).map((a) => (
                    <span key={a} className="chip">
                      {titleCase(a)}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
