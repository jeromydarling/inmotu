import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { Badge, EmptyState, Spinner } from "../../components/ui";

export default function GaragePanel() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <SetupDatabase />
      <StintPlanner />
    </div>
  );
}

function SetupDatabase() {
  const [setups, setSetups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ label: "", conditions: "", spring: "", gearing: "", tire: "", notes: "" });

  function load() {
    api.setups().then((r) => setSetups(r.setups)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) return;
    await api.createSetup({
      label: form.label,
      conditions: form.conditions,
      data: { spring: form.spring, gearing: form.gearing, tire: form.tire, notes: form.notes },
    });
    setForm({ label: "", conditions: "", spring: "", gearing: "", tire: "", notes: "" });
    load();
  }

  async function remove(id: string) {
    setSetups((p) => p.filter((s) => s.id !== id));
    await api.deleteSetup(id).catch(load);
  }

  return (
    <div>
      <h3 className="mb-1 font-display text-xl font-bold">Setup database</h3>
      <p className="mb-4 text-sm text-white/50">Store setups by track & conditions. Never guess twice.</p>

      <form onSubmit={add} className="panel mb-4 grid gap-2 p-4 sm:grid-cols-2">
        <input className="field" placeholder="Label (e.g. Brainerd dry)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
        <input className="field" placeholder="Conditions (dry / 85°F)" value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} />
        <input className="field" placeholder="Springs / shocks" value={form.spring} onChange={(e) => setForm({ ...form, spring: e.target.value })} />
        <input className="field" placeholder="Gearing" value={form.gearing} onChange={(e) => setForm({ ...form, gearing: e.target.value })} />
        <input className="field" placeholder="Tire / pressure" value={form.tire} onChange={(e) => setForm({ ...form, tire: e.target.value })} />
        <input className="field" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button className="btn-primary sm:col-span-2">Save setup</button>
      </form>

      {loading ? (
        <Spinner className="mx-auto h-6 w-6" />
      ) : setups.length === 0 ? (
        <EmptyState title="No setups yet" hint="Log your first baseline setup above." />
      ) : (
        <div className="space-y-2">
          {setups.map((s) => {
            let d: any = {};
            try { d = s.data ? JSON.parse(s.data) : {}; } catch {}
            return (
              <div key={s.id} className="panel p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display font-bold text-white">{s.label}</div>
                    {s.conditions && <div className="text-xs text-white/45">{s.conditions}</div>}
                  </div>
                  <button onClick={() => remove(s.id)} className="text-white/30 hover:text-flag-red" aria-label="Delete">✕</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.spring && <span className="chip">Spring: {d.spring}</span>}
                  {d.gearing && <span className="chip">Gear: {d.gearing}</span>}
                  {d.tire && <span className="chip">Tire: {d.tire}</span>}
                </div>
                {d.notes && <p className="mt-2 text-sm text-white/55">{d.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StintPlanner() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", race_minutes: "840", stint_minutes: "110", fuel_minutes: "115", drivers: "" });

  function load() {
    api.stints().then((r) => setPlans(r.plans)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const calc = useMemo(() => {
    const race = +form.race_minutes || 0;
    const stint = +form.stint_minutes || 0;
    const fuel = +form.fuel_minutes || 0;
    if (!race || !stint) return null;
    const stints = Math.ceil(race / stint);
    const pitStops = Math.max(0, stints - 1);
    const fuelOk = stint <= fuel;
    const drivers = form.drivers.split(",").map((d) => d.trim()).filter(Boolean);
    return { stints, pitStops, fuelOk, drivers };
  }, [form]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.createStint({
      name: form.name,
      race_minutes: +form.race_minutes,
      stint_minutes: +form.stint_minutes,
      fuel_minutes: +form.fuel_minutes,
      drivers: form.drivers.split(",").map((d) => d.trim()).filter(Boolean),
    });
    setForm({ ...form, name: "" });
    load();
  }

  async function remove(id: string) {
    setPlans((p) => p.filter((x) => x.id !== id));
    await api.deleteStint(id).catch(load);
  }

  return (
    <div>
      <h3 className="mb-1 font-display text-xl font-bold">Stint planner</h3>
      <p className="mb-4 text-sm text-white/50">Endurance driver rotation + fuel-window math, live as you type.</p>

      <form onSubmit={add} className="panel mb-4 p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="field" placeholder="Plan name (ChampCar 14h)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="field" placeholder="Drivers (comma separated)" value={form.drivers} onChange={(e) => setForm({ ...form, drivers: e.target.value })} />
          <label className="text-xs text-white/50">Race minutes
            <input className="field mt-1" type="number" value={form.race_minutes} onChange={(e) => setForm({ ...form, race_minutes: e.target.value })} />
          </label>
          <label className="text-xs text-white/50">Stint minutes
            <input className="field mt-1" type="number" value={form.stint_minutes} onChange={(e) => setForm({ ...form, stint_minutes: e.target.value })} />
          </label>
          <label className="text-xs text-white/50">Fuel window (min)
            <input className="field mt-1" type="number" value={form.fuel_minutes} onChange={(e) => setForm({ ...form, fuel_minutes: e.target.value })} />
          </label>
        </div>

        {calc && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-carbon-900/60 p-3">
            <Badge tone="live">{calc.stints} stints</Badge>
            <Badge tone="amber">{calc.pitStops} pit stops</Badge>
            {calc.fuelOk ? (
              <Badge tone="green">Fuel OK</Badge>
            ) : (
              <Badge tone="red">Stint &gt; fuel window!</Badge>
            )}
            {calc.drivers.length > 0 && (
              <span className="text-xs text-white/50">
                Rotation: {Array.from({ length: calc.stints }, (_, i) => calc.drivers[i % calc.drivers.length]).join(" → ")}
              </span>
            )}
          </div>
        )}
        <button className="btn-primary mt-3 w-full">Save plan</button>
      </form>

      {loading ? (
        <Spinner className="mx-auto h-6 w-6" />
      ) : plans.length === 0 ? (
        <EmptyState title="No stint plans yet" hint="Plan your first enduro above." />
      ) : (
        <div className="space-y-2">
          {plans.map((p) => {
            const stints = Math.ceil(p.race_minutes / p.stint_minutes);
            return (
              <div key={p.id} className="panel flex items-center justify-between p-4">
                <div>
                  <div className="font-display font-bold text-white">{p.name}</div>
                  <div className="text-xs text-white/45">
                    {p.race_minutes}min · {stints} stints · fuel {p.fuel_minutes}min
                  </div>
                </div>
                <button onClick={() => remove(p.id)} className="text-white/30 hover:text-flag-red" aria-label="Delete">✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
