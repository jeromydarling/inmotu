import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Spinner, Badge } from "../components/ui";
import { AiImage } from "../components/motion";
import { ShareButton } from "../components/ShareButton";
import { titleCase } from "../lib/format";

export default function TeamPage() {
  const { slug } = useParams();
  const [data, setData] = useState<{ page: any; riders: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    api.publicTeamPage(slug).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [slug]);

  if (loading)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  if (!data)
    return (
      <div className="container-page py-24 text-center text-white/50">
        This page isn't available. <Link to="/" className="text-ignition">Go home</Link>
      </div>
    );

  const { page, riders } = data;
  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <AiImage slug={page.hero_slug || "paddock"} kenBurns overlay={false} className="absolute inset-0 -z-10 h-full w-full" imgClassName="opacity-50" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-carbon-950 via-carbon-950/70 to-carbon-950/40" />
        <div className="container-page py-24 sm:py-32">
          {page.discipline && <Badge tone="amber">{titleCase(page.discipline)}</Badge>}
          <h1 className="mt-4 font-display text-5xl font-black tracking-tightest drop-shadow-lg sm:text-6xl">
            {page.name}
          </h1>
          {page.tagline && <p className="mt-3 max-w-xl text-lg text-ignition-300">{page.tagline}</p>}
          {page.hometown && <p className="mt-2 text-sm text-white/50">📍 {page.hometown}</p>}
          <div className="mt-6">
            <ShareButton title={page.name} text={page.tagline || `Follow ${page.name} on inmotu`} />
          </div>
        </div>
      </section>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          {page.bio && (
            <>
              <h2 className="mb-2 font-display text-xl font-bold">About</h2>
              <p className="whitespace-pre-wrap text-white/65">{page.bio}</p>
            </>
          )}
          {riders.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 font-display text-xl font-bold">The riders</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {riders.map((r, i) => (
                  <div key={i} className="panel flex items-center gap-3 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ignition/15 font-display text-lg font-black text-ignition">
                      {r.number || r.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-display font-bold text-white">{r.name}</div>
                      <div className="text-xs text-white/45">{r.race_class || titleCase(r.discipline || "")}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-6 text-center">
            <p className="text-sm text-white/60">Built with</p>
            <Link to="/" className="font-display text-2xl font-extrabold">
              in<span className="text-ignition">motu</span>
            </Link>
            <p className="mt-2 text-xs text-white/40">The home for grassroots motorsports families.</p>
            <Link to="/register" className="btn-primary mt-4 w-full">
              Start your own →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
