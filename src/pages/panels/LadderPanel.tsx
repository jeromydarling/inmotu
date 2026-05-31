import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Rider } from "@shared/types";
import { Badge, EmptyState, Spinner } from "../../components/ui";

export default function LadderPanel() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .riders()
      .then((r) => {
        setRiders(r.riders);
        setActive(r.riders[0]?.id ?? null);
      })
      .catch(() => setRiders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner className="mx-auto h-8 w-8" />;
  if (riders.length === 0)
    return (
      <EmptyState
        title="Add a racer to track the ladder"
        hint="Head to the Riders tab and add a racer, then come back to chart their road to the top."
      />
    );

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {riders.map((r) => (
          <button
            key={r.id}
            onClick={() => setActive(r.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              active === r.id
                ? "border-ignition/50 bg-ignition/15 text-ignition-300"
                : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
            }`}
          >
            {r.number ? `#${r.number} ` : ""}
            {r.name}
          </button>
        ))}
      </div>
      {active && <RiderLadder key={active} riderId={active} />}
    </div>
  );
}

function RiderLadder({ riderId }: { riderId: string }) {
  const [data, setData] = useState<{ rider: any; ladder: any; stages: any[] } | null>(null);
  const [pos, setPos] = useState<Record<string, string>>({});

  function load() {
    api.riderLadder(riderId).then(setData).catch(() => setData(null));
  }
  useEffect(load, [riderId]);

  async function record(stageId: string) {
    const p = pos[stageId];
    await api.recordLadder({ rider_id: riderId, stage_id: stageId, result_pos: p ? Number(p) : null });
    setPos((s) => ({ ...s, [stageId]: "" }));
    load();
  }
  async function clear(progressId: string) {
    await api.clearLadder(progressId);
    load();
  }

  if (!data) return <Spinner className="mx-auto h-6 w-6" />;
  if (!data.ladder)
    return (
      <EmptyState
        title="No ladder for this discipline yet"
        hint="We're building out the progression path for this sport. Motocross, BMX, and drag racing are live now."
      />
    );

  const isPoints = data.ladder.progression === "track_points";
  // A cleared stage = advancement (ladder) or "you made it" (track points).
  const reached = data.stages.filter((s) => s.advanced).length;

  return (
    <div>
      <div className="panel mb-5 flex items-center justify-between p-5">
        <div>
          <p className="eyebrow">{data.ladder.name}</p>
          <h3 className="mt-1 font-display text-xl font-bold">
            {data.rider.name} · {data.rider.race_class || "Open"}
          </h3>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl font-extrabold text-flag-green">
            {reached}/{data.stages.length}
          </div>
          <div className="text-xs text-white/45">{isPoints ? "rungs reached" : "stages cleared"}</div>
        </div>
      </div>

      <div className="relative space-y-3 pl-6">
        <div className="absolute bottom-3 left-[7px] top-3 w-px bg-white/10" />
        {data.stages.map((s, i) => {
          const has = s.progress_id != null;
          const advanced = !!s.advanced;
          return (
            <div key={s.id} className="relative">
              <span
                className={`absolute -left-[22px] top-5 h-3.5 w-3.5 rounded-full border-2 border-carbon-950 ${
                  advanced ? "bg-flag-green" : has ? "bg-amber" : "bg-carbon-600"
                }`}
              />
              <div
                className={`panel p-4 ${
                  advanced ? "border-flag-green/25" : has ? "border-amber/25" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white/30">0{i + 1}</span>
                      <span className="font-display text-lg font-bold text-white">{s.name}</span>
                    </div>
                    {s.region && <div className="text-xs text-white/45">{s.region}</div>}
                    {s.advance_note && <div className="mt-1 text-xs text-white/40">{s.advance_note}</div>}
                  </div>
                  {has ? (
                    <div className="flex shrink-0 items-center gap-2">
                      {s.result_pos != null && <Badge tone="muted">P{s.result_pos}</Badge>}
                      <Badge tone={advanced ? "green" : "amber"}>
                        {advanced ? (isPoints ? "Made it ✓" : "Advanced ✓") : "Logged"}
                      </Badge>
                      <button onClick={() => clear(s.progress_id)} className="text-white/30 hover:text-flag-red" aria-label="Clear">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Finish"
                        value={pos[s.id] ?? ""}
                        onChange={(e) => setPos((st) => ({ ...st, [s.id]: e.target.value }))}
                        className="field w-24 py-1.5 text-sm"
                      />
                      <button onClick={() => record(s.id)} className="btn-primary btn-sm">
                        Log
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-white/40">
        {isPoints
          ? "Log how you finished at each step — bank your points, make the team, and chase the title. Each cleared rung lights up the next."
          : "Log a finish at each stage — top finishers advance automatically and light up the next rung on the way to the top."}
      </p>
    </div>
  );
}
