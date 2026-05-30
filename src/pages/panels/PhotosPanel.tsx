import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { Rider } from "@shared/types";
import { Badge, EmptyState, Spinner } from "../../components/ui";

export default function PhotosPanel() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rider, setRider] = useState("");
  const [caption, setCaption] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    api.photos().then((r) => setPhotos(r.photos)).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.riders().then((r) => setRiders(r.riders)).catch(() => {});
  }, []);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        if (rider) fd.append("rider_id", rider);
        if (caption) fd.append("caption", caption);
        await api.uploadPhoto(fd);
      }
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setPhotos((p) => p.filter((x) => x.id !== id));
    await api.deletePhoto(id).catch(load);
  }

  return (
    <div className="space-y-8">
      <YearbookBlock riders={riders} photoCount={photos.length} />

      <div>
        <h3 className="mb-1 font-display text-xl font-bold">Season timeline</h3>
        <p className="mb-4 text-sm text-white/50">
          Upload the moments — they become your photo timeline and the pages of your printed
          yearbook.
        </p>

        <div className="panel mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <select className="field sm:max-w-[12rem]" value={rider} onChange={(e) => setRider(e.target.value)}>
            <option value="" className="bg-carbon-900">All riders</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id} className="bg-carbon-900">{r.name}</option>
            ))}
          </select>
          <input className="field flex-1" placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <button className="btn-primary shrink-0" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Uploading…" : "＋ Add photos"}
          </button>
        </div>
        {err && <div className="mb-4 rounded-lg border border-flag-red/30 bg-flag-red/10 px-3 py-2 text-sm text-flag-red">{err}</div>}

        {loading ? (
          <Spinner className="mx-auto h-8 w-8" />
        ) : photos.length === 0 ? (
          <EmptyState title="No photos yet" hint="Add a few race-day shots to start your timeline." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <figure key={p.id} className="panel group relative overflow-hidden">
                <img
                  src={`/api/photos/${p.id}/raw`}
                  alt={p.caption || ""}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <button
                  onClick={() => remove(p.id)}
                  className="absolute right-2 top-2 rounded-lg bg-carbon-950/70 px-2 py-1 text-xs text-white/70 opacity-0 backdrop-blur transition group-hover:opacity-100 hover:text-flag-red"
                  aria-label="Delete photo"
                >
                  ✕
                </button>
                {p.caption && (
                  <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-carbon-950 to-transparent px-2 py-1.5 text-xs text-white/80">
                    {p.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function YearbookBlock({ riders, photoCount }: { riders: Rider[]; photoCount: number }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [rider, setRider] = useState("");
  const season = new Date().getFullYear();

  function load() {
    api.yearbooks().then((r) => setOrders(r.orders)).catch(() => {});
  }
  useEffect(load, []);

  async function order() {
    const { order } = await api.createYearbook({ rider_id: rider || null, season });
    try {
      const { url } = await api.yearbookCheckout(order.id);
      if (url) window.location.href = url;
      else load();
    } catch {
      load(); // checkout not configured yet — order saved as draft
    }
  }

  return (
    <div className="panel relative overflow-hidden p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <Badge tone="amber">📖 Season Yearbook</Badge>
          <h3 className="mt-3 font-display text-2xl font-extrabold tracking-tightest">
            Turn the season into a book they'll keep forever.
          </h3>
          <p className="mt-2 text-sm text-white/55">
            We compile your {photoCount} photo{photoCount === 1 ? "" : "s"} into a beautiful printed
            hardcover and ship it to your door. $59 — a keepsake of their whole year.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select className="field max-w-[12rem]" value={rider} onChange={(e) => setRider(e.target.value)}>
              <option value="" className="bg-carbon-900">Whole family</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id} className="bg-carbon-900">{r.name}</option>
              ))}
            </select>
            <button className="btn-primary" onClick={order} disabled={photoCount === 0}>
              Order {season} book · $59
            </button>
          </div>
          {photoCount === 0 && <p className="mt-2 text-xs text-white/40">Add some photos first to build your book.</p>}
        </div>

        {orders.length > 0 && (
          <div className="w-full max-w-xs space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Your books</p>
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-carbon-850 px-3 py-2 text-sm">
                <span className="text-white/80">{o.title}</span>
                <Badge tone={o.status === "draft" ? "muted" : "green"}>{o.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
