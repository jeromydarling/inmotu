import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Badge, EmptyState, Spinner } from "../../components/ui";
import { fmtMoney, fmtDate } from "../../lib/format";

const tierTone: Record<string, any> = { title: "live", associate: "amber", contingency: "muted" };

export default function SponsorsPanel() {
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", tier: "associate", amount: "", deliverables: "" });

  function load() {
    api.sponsors().then((r) => setSponsors(r.sponsors)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.addSponsor({
      name: form.name,
      tier: form.tier,
      amount_cents: form.amount ? Math.round(parseFloat(form.amount) * 100) : null,
      deliverables: form.deliverables
        ? form.deliverables.split(",").map((t) => ({ text: t.trim(), done: false })).filter((d) => d.text)
        : [],
    });
    setForm({ name: "", tier: "associate", amount: "", deliverables: "" });
    setShow(false);
    load();
  }
  async function toggleDeliverable(s: any, idx: number) {
    const d = JSON.parse(s.deliverables || "[]");
    d[idx].done = !d[idx].done;
    setSponsors((p) => p.map((x) => (x.id === s.id ? { ...x, deliverables: JSON.stringify(d) } : x)));
    await api.updateSponsor(s.id, { deliverables: d }).catch(load);
  }
  async function remove(id: string) {
    setSponsors((p) => p.filter((s) => s.id !== id));
    await api.deleteSponsor(id).catch(load);
  }

  const total = sponsors.reduce((s, x) => s + (x.amount_cents || 0), 0);

  if (loading) return <Spinner className="mx-auto h-8 w-8" />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-white/55">Your sponsorship portfolio — value, deliverables, and renewals in one place.</p>
          <p className="mt-0.5 text-xs text-white/40">Portfolio value: <span className="font-semibold text-white">{fmtMoney(total)}/yr</span></p>
        </div>
        <button onClick={() => setShow((v) => !v)} className="btn-primary btn-sm shrink-0">{show ? "Cancel" : "+ Add sponsor"}</button>
      </div>

      {show && (
        <form onSubmit={add} className="panel mb-6 grid gap-3 p-5 sm:grid-cols-2">
          <input className="field" placeholder="Sponsor name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className="field" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
            {["title", "associate", "contingency"].map((t) => <option key={t} value={t} className="bg-carbon-900 capitalize">{t}</option>)}
          </select>
          <input className="field" type="number" step="0.01" placeholder="Annual value (USD)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className="field" placeholder="Deliverables (comma separated)" value={form.deliverables} onChange={(e) => setForm({ ...form, deliverables: e.target.value })} />
          <button className="btn-primary sm:col-span-2">Save sponsor</button>
        </form>
      )}

      {sponsors.length === 0 ? (
        <EmptyState title="No sponsors yet" hint="Track your deals, deliverables, and renewal dates here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sponsors.map((s) => {
            const deliverables = JSON.parse(s.deliverables || "[]");
            return (
              <div key={s.id} className="panel p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display text-lg font-bold text-white">{s.name}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone={tierTone[s.tier] ?? "muted"}>{s.tier}</Badge>
                      {s.amount_cents != null && <span className="text-sm text-white/60">{fmtMoney(s.amount_cents)}/yr</span>}
                    </div>
                  </div>
                  <button onClick={() => remove(s.id)} className="text-white/30 hover:text-flag-red" aria-label="Delete">✕</button>
                </div>
                {deliverables.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {deliverables.map((d: any, i: number) => (
                      <label key={i} className="flex items-center gap-2 text-sm text-white/65">
                        <input type="checkbox" checked={!!d.done} onChange={() => toggleDeliverable(s, i)} />
                        <span className={d.done ? "text-white/40 line-through" : ""}>{d.text}</span>
                      </label>
                    ))}
                  </div>
                )}
                {s.renewal_at && <div className="mt-3 text-xs text-white/40">Renews {fmtDate(s.renewal_at)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
