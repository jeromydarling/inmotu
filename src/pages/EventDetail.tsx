import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Badge, Spinner } from "../components/ui";
import { ShareButton } from "../components/ShareButton";
import { fmtDate, fmtMoney, daysUntil, titleCase } from "../lib/format";
import { useAuth } from "../state/auth";

export default function EventDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [e, setE] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    api
      .event(slug)
      .then((r) => setE(r.event))
      .catch(() => setE(null))
      .finally(() => setLoading(false));
  }, [slug]);

  async function toggleSave() {
    if (!user) {
      nav("/login", { state: { from: `/events/${slug}` } });
      return;
    }
    setE((p: any) => ({ ...p, saved: !p.saved }));
    await api.toggleSave(e.id).catch(() => setE((p: any) => ({ ...p, saved: !p.saved })));
  }

  function downloadIcs() {
    const dt = (s: number) =>
      new Date(s * 1000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//inmotu//Grid//EN",
      "BEGIN:VEVENT",
      `UID:${e.id}@inmotu.pro`,
      `DTSTAMP:${dt(Math.floor(Date.now() / 1000))}`,
      `DTSTART:${dt(e.starts_at)}`,
      e.ends_at ? `DTEND:${dt(e.ends_at)}` : `DTEND:${dt(e.starts_at + 86400)}`,
      `SUMMARY:${e.title}`,
      `LOCATION:${e.track_name ?? ""}${e.track_state ? `, ${e.track_state}` : ""}`,
      `DESCRIPTION:via inmotu — ${e.external_url ?? "inmotu.pro"}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${e.slug}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  if (!e)
    return (
      <div className="container-page py-24 text-center text-white/50">
        Event not found. <Link to="/grid" className="text-ignition">Back to The Grid</Link>
      </div>
    );

  const regClose = daysUntil(e.reg_closes_at);

  return (
    <div className="container-page py-12">
      <Link to="/grid" className="text-sm text-white/40 hover:text-white">
        ← The Grid
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {e.level && <Badge tone="amber">{titleCase(e.level)}</Badge>}
            {e.discipline && <Badge>{titleCase(e.discipline)}</Badge>}
            {e.body_slug && <Badge tone="muted">{String(e.body_slug).toUpperCase()}</Badge>}
            {e.age_group && <Badge tone="muted">{titleCase(e.age_group)}</Badge>}
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tightest">{e.title}</h1>
          <p className="mt-2 text-lg text-white/55">{fmtDate(e.starts_at)}</p>

          {regClose != null && regClose >= 0 && regClose <= 14 && (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-flag-red/30 bg-flag-red/10 px-4 py-3 text-sm">
              <span className="h-2 w-2 animate-pulse-live rounded-full bg-flag-red" />
              <span className="font-semibold text-flag-red">
                Registration closes in {regClose} day{regClose === 1 ? "" : "s"}
              </span>
              <span className="text-white/40">· {fmtDate(e.reg_closes_at)}</span>
            </div>
          )}

          <div className="panel mt-6 grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-4">
            <Fact label="Entry fee" value={fmtMoney(e.entry_fee_cents)} />
            <Fact label="Gate fee" value={fmtMoney(e.gate_fee_cents)} />
            <Fact label="Region" value={e.region ?? "—"} />
            <Fact label="Source" value={String(e.source).toUpperCase()} />
          </div>

          {e.track_name && (
            <div className="panel mt-6 p-6">
              <p className="eyebrow">Venue</p>
              <Link
                to={`/tracks/${e.track_slug}`}
                className="mt-2 block font-display text-2xl font-bold hover:text-ignition-300"
              >
                {e.track_name}
              </Link>
              <p className="text-white/50">
                {e.track_city}, {e.track_state}
              </p>
            </div>
          )}

          <LiveResults slug={e.slug} />
        </div>

        {/* Action rail */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-6">
            <button onClick={toggleSave} className={e.saved ? "btn-ghost w-full" : "btn-primary w-full"}>
              {e.saved ? "★ Saved to calendar" : "☆ Save to my calendar"}
            </button>
            <button onClick={downloadIcs} className="btn-ghost mt-3 w-full">
              Add to device calendar (.ics)
            </button>
            <div className="mt-3">
              <ShareButton title={e.title} text={`Racing at ${e.track_name ?? "the track"} — see it on inmotu`} className="btn-ghost w-full" label="Share this event" />
            </div>
            {e.external_url && (
              <a
                href={e.external_url}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost mt-3 w-full"
              >
                Register at source ↗
              </a>
            )}
            <p className="mt-4 text-center text-xs text-white/35">
              Saved events show their deadlines on your dashboard.
            </p>
          </div>
          {user && <RegisterBox eventId={e.id} fee={e.entry_fee_cents} />}
        </aside>
      </div>
    </div>
  );
}

function RegisterBox({ eventId, fee }: { eventId: string; fee: number | null }) {
  const [riders, setRiders] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [cls, setCls] = useState("");
  const [miles, setMiles] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.riders().then((r) => setRiders(r.riders)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.registerForEvent(eventId, {
        rider_name: name,
        race_class: cls || null,
        travel_miles: miles ? Number(miles) : null,
      });
      setDone(true);
    } catch (e: any) {
      setErr(e.message || "Registration failed");
    }
  }

  if (done)
    return (
      <div className="panel mt-4 border-flag-green/30 p-6 text-center">
        <div className="text-2xl">✅</div>
        <p className="mt-1 font-display font-bold text-flag-green">{name} is registered</p>
        <p className="text-xs text-white/45">Find it under Dashboard → My Calendar.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="panel mt-4 p-6">
      <p className="eyebrow">Register a rider</p>
      {err && <div className="mt-2 rounded-lg border border-flag-red/30 bg-flag-red/10 px-3 py-2 text-xs text-flag-red">{err}</div>}
      <input
        className="field mt-3"
        list="rider-list"
        placeholder="Rider name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          const m = riders.find((r) => r.name === e.target.value);
          if (m) setCls(m.race_class || "");
        }}
        required
      />
      <datalist id="rider-list">
        {riders.map((r) => (
          <option key={r.id} value={r.name} />
        ))}
      </datalist>
      <input className="field mt-2" placeholder="Class" value={cls} onChange={(e) => setCls(e.target.value)} />
      <input className="field mt-2" type="number" placeholder="Travel distance (miles)" value={miles} onChange={(e) => setMiles(e.target.value)} />
      <button className="btn-primary mt-3 w-full">
        Register{fee != null ? ` · ${fmtMoney(fee)}` : ""}
      </button>
      <p className="mt-2 text-center text-[11px] text-white/35">
        Travel miles feed the track's economic-impact report.
      </p>
    </form>
  );
}

// Live timing & results, powered by MYLAPS/Speedhive (or operator entry).
// Auto-refreshes while any session is still running; silent if there's nothing.
function LiveResults({ slug }: { slug: string }) {
  const [data, setData] = useState<{ linked: boolean; sessions: any[] } | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let timer: any;
    let cancelled = false;
    const load = async (refresh: boolean) => {
      try {
        const r = await api.eventResults(slug, refresh);
        if (cancelled) return;
        setData(r);
        // poll while a session is live
        const running = r.sessions.some((s) => s.status === "running");
        if (running) timer = setTimeout(() => load(true), 20000);
      } catch {
        if (!cancelled) setData({ linked: false, sessions: [] });
      }
    };
    load(true);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug]);

  if (!data || (data.sessions.length === 0 && !data.linked)) return null;

  const s = data.sessions[active];
  return (
    <div className="panel mt-6 p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Live results</p>
        <span className="flex items-center gap-1.5 text-[11px] text-white/40">
          <span className="text-ignition-300">MYLAPS · Speedhive</span>
        </span>
      </div>

      {data.sessions.length === 0 ? (
        <p className="mt-3 text-sm text-white/45">
          Linked to Speedhive — results will appear here once timing is live.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.sessions.map((sess, i) => (
              <button
                key={sess.id}
                onClick={() => setActive(i)}
                className={`chip ${i === active ? "bg-ignition/20 text-ignition-300" : ""}`}
              >
                {sess.name}
                {sess.race_class ? ` · ${sess.race_class}` : ""}
                {sess.status === "running" && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse-live rounded-full bg-flag-red align-middle" />
                )}
              </button>
            ))}
          </div>

          {s && (
            <div className="mt-4 overflow-x-auto">
              {s.status === "running" && (
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-flag-red">
                  <span className="h-2 w-2 animate-pulse-live rounded-full bg-flag-red" /> LIVE · updating
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-white/35">
                    <th className="py-1.5 pr-2">Pos</th>
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-3">Competitor</th>
                    <th className="py-1.5 pr-2 text-right">Laps</th>
                    <th className="py-1.5 pr-2 text-right">Best</th>
                    <th className="py-1.5 text-right">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {s.rows.length === 0 ? (
                    <tr><td colSpan={6} className="py-4 text-center text-white/40">No times posted yet.</td></tr>
                  ) : (
                    s.rows.map((r: any) => (
                      <tr key={r.id} className="border-t border-white/[0.06]">
                        <td className="py-1.5 pr-2 font-display font-bold text-white">{r.position ?? "—"}</td>
                        <td className="py-1.5 pr-2 text-white/55">{r.start_number ?? ""}</td>
                        <td className="py-1.5 pr-3">
                          {r.rider_id ? (
                            <span className="font-semibold text-ignition-300">{r.competitor} ★</span>
                          ) : (
                            <span className="text-white/80">{r.competitor}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 text-right text-white/55">{r.laps ?? "—"}</td>
                        <td className="py-1.5 pr-2 text-right font-mono text-xs text-white/70">{r.best_lap ?? "—"}</td>
                        <td className="py-1.5 text-right font-mono text-xs text-white/55">{r.gap ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-white/30">★ = a rider on your Pit Board</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-carbon-850 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 font-display text-lg font-bold text-white">{value}</div>
    </div>
  );
}
