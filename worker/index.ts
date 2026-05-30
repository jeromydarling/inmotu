import { Hono } from "hono";
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

api.notFound((c) => c.json({ error: "Not found" }, 404));
api.onError((err, c) => {
  console.error("API error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.route("/api", api);

// Everything else is served by the static-asset (SPA) handler. With
// not_found_handling=single-page-application, unknown paths return index.html.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
