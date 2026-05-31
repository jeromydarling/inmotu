import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api/client";
import { SECTORS, type SectorId } from "@shared/types";
import { Spinner } from "../components/ui";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

// Admin Control — cost dashboard (today's API spend vs cap), engine status,
// pending review queues, on-demand discovery, and the crew verify queue.
export default function Admin() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const [cost, setCost] = useState<Awaited<ReturnType<typeof api.adminCost>> | null>(null);
  const [sector, setSector] = useState<SectorId>("bmx");
  const [state, setState] = useState("GA");
  const [running, setRunning] = useState(false);
  const [crews, setCrews] = useState<any[]>([]);
  const [smoke, setSmoke] = useState<Awaited<ReturnType<typeof api.adminSmoke>>["results"] | null>(null);
  const [smoking, setSmoking] = useState(false);

  async function runSmoke() {
    setSmoking(true);
    try {
      const r = await api.adminSmoke();
      setSmoke(r.results);
    } catch {
      toast.error("Smoke test failed to run.");
    } finally {
      setSmoking(false);
    }
  }

  function loadCost() {
    api.adminCost().then(setCost).catch(() => setCost(null));
  }
  useEffect(() => { if (user?.role === "admin") loadCost(); }, [user?.role]);

  if (loading) return <div className="container-page py-20"><Spinner className="mx-auto h-8 w-8" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/app" replace />;

  async function runDiscovery() {
    setRunning(true);
    try {
      const r = await api.adminDiscover(sector, state);
      if (!r.configured) toast.error("Perplexity key not configured.");
      else if (!r.ran) toast.success("Already discovered (cached) or budget reached.");
      else toast.success(`Discovered ${r.events} events, ${r.crews} crews in ${state}.`);
      loadCost();
      loadCrews();
    } catch {
      toast.error("Discovery failed.");
    } finally {
      setRunning(false);
    }
  }

  function loadCrews() {
    api.adminCrews(sector, state).then((r) => setCrews(r.crews)).catch(() => setCrews([]));
  }

  async function review(id: string, approve: boolean) {
    setCrews((cs) => cs.filter((c) => c.id !== id));
    await api.adminReviewCrew(id, approve).catch(() => { loadCrews(); toast.error("Couldn't update."); });
    loadCost();
  }

  return (
    <div className="container-page max-w-4xl py-12">
      <header className="mb-8">
        <p className="eyebrow">Admin · Control</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tightest">Cost &amp; discovery</h1>
        <p className="mt-2 text-white/55">Today's API spend, what's configured, and the review queues.</p>
      </header>

      {/* Budgets */}
      <section className="panel mb-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Today's API budget</h2>
          <button onClick={loadCost} className="btn-ghost btn-sm">Refresh</button>
        </div>
        {!cost ? (
          <Spinner className="mx-auto my-6 h-6 w-6" />
        ) : (
          <div className="mt-4 space-y-4">
            {cost.budgets.map((b) => {
              const pct = b.limit > 0 ? Math.min(100, Math.round((b.used / b.limit) * 100)) : 0;
              const hot = pct >= 80;
              return (
                <div key={b.api}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold capitalize text-white">
                      {b.api}
                      {!b.configured && <span className="ml-2 text-xs text-white/35">(no key)</span>}
                    </span>
                    <span className={hot ? "text-flag-red" : "text-white/55"}>{b.used} / {b.limit}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${hot ? "bg-flag-red" : "bg-gradient-to-r from-ignition to-amber"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Engine status + pending */}
      {cost && (
        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="panel p-5">
            <h3 className="font-display font-bold">Engines</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(cost.engines).map(([name, on]) => (
                <span key={name} className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${on ? "bg-flag-green/15 text-flag-green" : "bg-white/[0.06] text-white/40"}`}>
                  {on ? "● " : "○ "}{name}
                </span>
              ))}
            </div>
          </div>
          <div className="panel p-5">
            <h3 className="font-display font-bold">Pending review</h3>
            <div className="mt-3 flex gap-6">
              <div><div className="font-display text-2xl font-extrabold text-amber">{cost.pending.events}</div><div className="text-xs text-white/45">events</div></div>
              <div><div className="font-display text-2xl font-extrabold text-amber">{cost.pending.crews}</div><div className="text-xs text-white/45">crews</div></div>
            </div>
          </div>
        </section>
      )}

      {/* Smoke test — confirm each live key actually works */}
      <section className="panel mb-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Engine smoke test</h2>
            <p className="mt-1 text-sm text-white/55">One live probe per engine — confirms each key actually works, not just that it's set.</p>
          </div>
          <button className="btn-primary" disabled={smoking} onClick={runSmoke}>{smoking ? "Probing…" : "Run smoke test"}</button>
        </div>
        {smoke && (
          <div className="mt-4 space-y-2">
            {smoke.map((r) => (
              <div key={r.engine} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-carbon-850 px-3 py-2 text-sm">
                <span className={`shrink-0 text-xs font-bold uppercase ${r.status === "ok" ? "text-flag-green" : r.status === "fail" ? "text-flag-red" : "text-white/35"}`}>
                  {r.status === "ok" ? "● ok" : r.status === "fail" ? "✕ fail" : "○ skip"}
                </span>
                <span className="w-28 shrink-0 font-semibold capitalize text-white">{r.engine.replace("_", " ")}</span>
                <span className="min-w-0 flex-1 truncate text-white/55">{r.detail}</span>
                {r.ms != null && <span className="shrink-0 text-xs text-white/35">{r.ms}ms</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* On-demand discovery + crew review */}
      <section className="panel p-6">
        <h2 className="font-display text-lg font-bold">Run discovery</h2>
        <p className="mt-1 text-sm text-white/55">Pull beginner events + local crews for a sector &amp; state (counts against the Perplexity budget; cached 21 days).</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <select className="field w-48" value={sector} onChange={(e) => setSector(e.target.value as SectorId)}>
            {(Object.keys(SECTORS) as SectorId[]).map((id) => <option key={id} value={id}>{SECTORS[id].label}</option>)}
          </select>
          <select className="field w-28" value={state} onChange={(e) => setState(e.target.value)}>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn-primary" disabled={running} onClick={runDiscovery}>{running ? "Running…" : "Discover"}</button>
          <button className="btn-ghost" onClick={loadCrews}>Load crews for review</button>
        </div>

        {crews.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs uppercase tracking-wide text-white/40">{crews.length} crew{crews.length === 1 ? "" : "s"} · {sector} / {state}</p>
            {crews.map((cr) => (
              <div key={cr.id} className="rounded-xl border border-white/[0.06] bg-carbon-850 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-white">{cr.name}</span>
                      {cr.verified === 1 ? <span className="text-[10px] font-semibold text-flag-green">✓ verified</span> : <span className="rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber">pending</span>}
                    </div>
                    <div className="text-xs text-white/45 capitalize">{(cr.kind || "club").replace("_", " ")}{cr.city ? ` · ${cr.city}, ${cr.state}` : ""}</div>
                    {cr.blurb && <p className="mt-1 text-xs text-white/55">{cr.blurb}</p>}
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                      {cr.website && <a href={cr.website} target="_blank" rel="noreferrer" className="text-ignition-300 hover:underline">site ↗</a>}
                      {cr.facebook && <a href={cr.facebook} target="_blank" rel="noreferrer" className="text-ignition-300 hover:underline">fb ↗</a>}
                      {cr.email && <span className="text-white/50">{cr.email}</span>}
                      {cr.phone && <span className="text-white/50">{cr.phone}</span>}
                      {(cr.citations ?? []).slice(0, 1).map((ct: any, i: number) => (
                        <a key={i} href={ct.url} target="_blank" rel="noreferrer" className="text-white/35 hover:underline">source ↗</a>
                      ))}
                    </div>
                  </div>
                  {cr.needs_review === 1 && (
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => review(cr.id, true)} className="rounded-lg bg-flag-green/15 px-2.5 py-1 text-xs font-semibold text-flag-green hover:bg-flag-green/25">Verify</button>
                      <button onClick={() => review(cr.id, false)} className="rounded-lg bg-flag-red/15 px-2.5 py-1 text-xs font-semibold text-flag-red hover:bg-flag-red/25">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
