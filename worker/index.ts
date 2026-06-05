import { Hono } from "hono";
import * as Sentry from "@sentry/cloudflare";
import type { Env, Vars } from "./types";
import { sessionMiddleware } from "./auth/middleware";
import auth from "./routes/auth";
import events from "./routes/events";
import tracks from "./routes/tracks";
import riders from "./routes/riders";
import advocacy from "./routes/advocacy";
import billing from "./routes/billing";
import meta from "./routes/meta";
import tower from "./routes/tower";
import garage from "./routes/garage";
import img from "./routes/img";
import ladder from "./routes/ladder";
import photos from "./routes/photos";
import yearbook from "./routes/yearbook";
import maintenance from "./routes/maintenance";
import comms from "./routes/comms";
import series from "./routes/series";
import sponsors from "./routes/sponsors";
import rules from "./routes/rules";
import demo from "./routes/demo";
import adminRoutes from "./routes/admin";
import studio from "./routes/studio";
import teampages from "./routes/teampages";
import notifications from "./routes/notifications";
import onboarding from "./routes/onboarding";
import mapRoutes from "./routes/map";
import venues from "./routes/venues";
import start from "./routes/start";
import racers from "./routes/racers";
import analytics from "./routes/analytics";
import translate from "./routes/translate";
import { ingestFromFeeds } from "./ingest";
import { runDeadlineSweep } from "./lib/notify";
import { refreshLegislation } from "./lib/perplexity";
import { refreshLiveResults } from "./lib/speedhive";
import { crawlSources } from "./lib/crawl";
import { sweepLaunchMarket } from "./lib/discovery";
import { importOsmVenues, enrichVenues, linkVenuesToTracks } from "./lib/venues";
import { renderWithMeta } from "./lib/seo";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// All API routes live under /api (run_worker_first in wrangler.jsonc).
const api = new Hono<{ Bindings: Env; Variables: Vars }>();
api.use("*", sessionMiddleware);

api.get("/health", (c) => c.json({ ok: true, env: c.env.APP_ENV }));
api.route("/auth", auth);
api.route("/events", events);
api.route("/tracks", tracks);
api.route("/riders", riders);
api.route("/advocacy", advocacy);
api.route("/billing", billing);
api.route("/meta", meta);
api.route("/tower", tower);
api.route("/garage", garage);
api.route("/img", img);
api.route("/ladder", ladder);
api.route("/photos", photos);
api.route("/yearbook", yearbook);
api.route("/maintenance", maintenance);
api.route("/comms", comms);
api.route("/series", series);
api.route("/sponsors", sponsors);
api.route("/rules", rules);
api.route("/demo", demo);
api.route("/admin", adminRoutes);
api.route("/studio", studio);
api.route("/teampages", teampages);
api.route("/notifications", notifications);
api.route("/onboarding", onboarding);
api.route("/map", mapRoutes);
api.route("/venues", venues);
api.route("/start", start);
api.route("/racers", racers);
api.route("/analytics", analytics);
api.route("/translate", translate);

api.notFound((c) => c.json({ error: "Not found" }, 404));
api.onError((err, c) => {
  console.error("API error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.route("/api", api);

// ── SEO / social: server-inject meta + JSON-LD for shareable public pages ──
const origin = (c: { env: Env; req: { url: string } }) =>
  c.env.APP_URL || new URL(c.req.url).origin;

// Team / family microsite
app.get("/t/:slug", async (c) => {
  const page = await c.env.DB.prepare(
    "SELECT name, tagline, bio, hometown, hero_slug FROM team_pages WHERE slug = ? AND published = 1",
  )
    .bind(c.req.param("slug"))
    .first<Record<string, any>>();
  if (!page) return c.env.ASSETS.fetch(c.req.raw);
  const o = origin(c);
  return renderWithMeta(c.env, c.req.raw, {
    title: `${page.name} — inmotu`,
    description: page.tagline || page.bio || `${page.name} on inmotu.`,
    url: `${o}/t/${c.req.param("slug")}`,
    image: `${o}/api/img/${page.hero_slug || "paddock"}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SportsTeam",
      name: page.name,
      description: page.bio || page.tagline || undefined,
      sport: "Motorsport",
      ...(page.hometown ? { location: { "@type": "Place", name: page.hometown } } : {}),
    },
  });
});

// Track profile
app.get("/tracks/:slug", async (c) => {
  const t = await c.env.DB.prepare(
    "SELECT name, city, state, discipline, status FROM tracks WHERE slug = ?",
  )
    .bind(c.req.param("slug"))
    .first<Record<string, any>>();
  if (!t) return c.env.ASSETS.fetch(c.req.raw);
  const o = origin(c);
  const loc = [t.city, t.state].filter(Boolean).join(", ");
  return renderWithMeta(c.env, c.req.raw, {
    title: `${t.name}${loc ? ` — ${loc}` : ""} | inmotu`,
    description: `${t.name} on inmotu — events, info${
      t.status === "endangered" ? ", and how to help protect this track." : "."
    }`,
    url: `${o}/tracks/${c.req.param("slug")}`,
    image: `${o}/api/img/${t.discipline === "motocross" ? "mx" : "car"}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SportsActivityLocation",
      name: t.name,
      ...(loc ? { address: { "@type": "PostalAddress", addressLocality: t.city, addressRegion: t.state } } : {}),
    },
  });
});

// Event detail
app.get("/events/:slug", async (c) => {
  const e = await c.env.DB.prepare(
    `SELECT e.title, e.starts_at, e.discipline, t.name AS track_name, t.city, t.state
     FROM events e LEFT JOIN tracks t ON t.id = e.track_id WHERE e.slug = ?`,
  )
    .bind(c.req.param("slug"))
    .first<Record<string, any>>();
  if (!e) return c.env.ASSETS.fetch(c.req.raw);
  const o = origin(c);
  const when = e.starts_at ? new Date(e.starts_at * 1000).toISOString() : undefined;
  return renderWithMeta(c.env, c.req.raw, {
    title: `${e.title} | inmotu`,
    description: `${e.title}${e.track_name ? ` at ${e.track_name}` : ""}${
      e.city ? `, ${e.city}, ${e.state}` : ""
    } — find it on inmotu.`,
    url: `${o}/events/${c.req.param("slug")}`,
    image: `${o}/api/img/disc-${e.discipline || "motocross"}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: e.title,
      ...(when ? { startDate: when } : {}),
      ...(e.track_name
        ? { location: { "@type": "Place", name: e.track_name, address: [e.city, e.state].filter(Boolean).join(", ") } }
        : {}),
    },
  });
});

// Racer profile (public, opt-in directory)
app.get("/racers/:slug", async (c) => {
  const r = await c.env.DB.prepare(
    "SELECT name, number, discipline, race_class, hometown FROM riders WHERE slug = ? AND published = 1",
  )
    .bind(c.req.param("slug"))
    .first<Record<string, any>>();
  if (!r) return c.env.ASSETS.fetch(c.req.raw);
  const o = origin(c);
  const num = r.number ? `#${r.number} ` : "";
  return renderWithMeta(c.env, c.req.raw, {
    title: `${num}${r.name} | inmotu`,
    description: `${r.name}${r.race_class ? ` · ${r.race_class}` : ""}${
      r.hometown ? ` · ${r.hometown}` : ""
    } — racing profile, results, and photos on inmotu.`,
    url: `${o}/racers/${c.req.param("slug")}`,
    image: `${o}/api/img/disc-${r.discipline || "motocross"}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Person",
      name: r.name,
      ...(r.hometown ? { homeLocation: { "@type": "Place", name: r.hometown } } : {}),
    },
  });
});

// Everything else is served by the static-asset (SPA) handler. With
// not_found_handling=single-page-application, unknown paths return index.html.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

const handler = {
  fetch: app.fetch,
  // Cron Trigger (daily): pull event feeds into The Grid, and reap demo
  // accounts older than 7 days (children cascade via FKs).
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const ingest = await ingestFromFeeds(env);
        const deadlines = await runDeadlineSweep(env);
        // Refresh live Right-to-Race legislation (no-op without a Perplexity key).
        const legislation = await refreshLegislation(env);
        // Refresh MYLAPS/Speedhive live results for events around now.
        const results = await refreshLiveResults(env);
        // Crawl configured web sources into reviewable events (no-op if none).
        const crawl = await crawlSources(env);
        // Fill in the launch market (Upper Midwest) one slice per run, within
        // budget — beachhead-first population of real events + crews.
        const launchSweep = await sweepLaunchMarket(env);
        // Refresh the national venue canvas from OSM weekly (Mondays) — it's a
        // heavy national pull, so we don't run it every day.
        let venuesImport: unknown = "skipped";
        if (new Date().getUTCDay() === 1) {
          venuesImport = await importOsmVenues(env);
          await linkVenuesToTracks(env);
        }
        // Incrementally enrich a batch of venues daily (no-op without a key).
        const venuesEnriched = await enrichVenues(env);
        const cutoff = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
        const reap = await env.DB.prepare(
          "DELETE FROM users WHERE is_demo = 1 AND created_at < ?",
        )
          .bind(cutoff)
          .run();
        console.log(
          "cron run",
          JSON.stringify({ ingest, deadlines, legislation, results, crawl: { sources: crawl.sources, events: crawl.events }, launchSweep, venuesImport, demoReaped: reap.meta.changes }),
        );
      })(),
    );
  },
};

// Wrap the whole handler (fetch + scheduled) so cron failures are captured,
// not just request errors. Federation-standard tags keep events comparable
// across the fleet; no-ops gracefully when SENTRY_DSN is unset.
export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    initialScope: {
      tags: {
        app_slug: "inmotu",
        federation_phase: "pre-launch",
        tier: "worker",
      },
    },
  }),
  handler,
) satisfies ExportedHandler<Env>;
