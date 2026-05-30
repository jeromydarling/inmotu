import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Rider } from "@shared/types";
import { Badge, EmptyState, Spinner } from "../../components/ui";
import { fmtDate, fmtMoney } from "../../lib/format";

export default function MaintenancePanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ rider_id: "", item: "", hours: "", cost: "", notes: "", add_to_budget: true });

  function load() {
    api.maintenance().then((r) => setLogs(r.logs)).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.riders().then((r) => {
      setRiders(r.riders);
      setForm((f) => ({ ...f, rider_id: r.riders[0]?.id ?? "" }));
    });
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.rider_id || !form.item.trim()) return;
    await api.addMaintenance({
      rider_id: form.rider_id,
      item: form.item,
      hours: form.hours ? Number(form.hours) : null,
      cost_cents: form.cost ? Math.round(parseFloat(form.cost) * 100) : null,
      notes: form.notes || null,
      add_to_budget: form.add_to_budget,
    });
    setForm({ ...form, item: "", hours: "", cost: "", notes: "" });
    setShow(false);
    load();
  }
  async function remove(id: string) {
    setLogs((p) => p.filter((l) => l.id !== id));
    await api.deleteMaintenance(id).catch(load);
  }

  const total = logs.reduce((s, l) => s + (l.cost_cents || 0), 0);

  if (loading) return <Spinner className="mx-auto h-8 w-8" />;
  if (riders.length === 0)
    return <EmptyState title="Add a rider first" hint="Maintenance logs are tracked per bike/rider." />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-white/55">Service history per bike — stay ahead of failures and know your true running costs.</p>
          <p className="mt-0.5 text-xs text-white/40">Logged spend: <span className="font-semibold text-white">{fmtMoney(total)}</span></p>
        </div>
        <button onClick={() => setShow((v) => !v)} className="btn-primary btn-sm shrink-0">
          {show ? "Cancel" : "+ Log service"}
        </button>
      </div>

      {show && (
        <form onSubmit={add} className="panel mb-6 grid gap-3 p-5 sm:grid-cols-2">
          <select className="field" value={form.rider_id} onChange={(e) => setForm({ ...form, rider_id: e.target.value })}>
            {riders.map((r) => <option key={r.id} value={r.id} className="bg-carbon-900">{r.name}</option>)}
          </select>
          <input className="field" placeholder="Item (e.g. Top end rebuild)" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} required />
          <input className="field" type="number" step="0.1" placeholder="Engine hours" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
          <input className="field" type="number" step="0.01" placeholder="Cost (USD)" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          <input className="field sm:col-span-2" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-white/60 sm:col-span-2">
            <input type="checkbox" checked={form.add_to_budget} onChange={(e) => setForm({ ...form, add_to_budget: e.target.checked })} />
            Also add cost to my season budget
          </label>
          <button className="btn-primary sm:col-span-2">Save service record</button>
        </form>
      )}

      {logs.length === 0 ? (
        <EmptyState title="No service logged yet" hint="Log your first top-end, oil change, or tire swap." />
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="panel flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-white">{l.item}</span>
                  {l.hours != null && <Badge tone="muted">{l.hours}h</Badge>}
                </div>
                <div className="text-xs text-white/45">
                  {l.rider_name} · {fmtDate(l.performed_at)}{l.notes ? ` · ${l.notes}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {l.cost_cents != null && <span className="font-semibold text-white">{fmtMoney(l.cost_cents)}</span>}
                <button onClick={() => remove(l.id)} className="text-white/30 hover:text-flag-red" aria-label="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
