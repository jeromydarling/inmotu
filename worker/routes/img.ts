import { Hono } from "hono";
import type { Env, Vars } from "../types";

// AI-generated imagery, cached in R2. Images are produced once by Workers AI
// (FLUX.1 schnell) on first request, stored, then served from R2 forever.
// A gradient SVG is returned if generation isn't ready yet, so the page never
// shows a broken image while the photographic layer warms up.

const PROMPTS: Record<string, string> = {
  hero:
    "Cinematic wide photograph of a youth motocross rider launching off a big dirt tabletop jump at golden-hour dusk, dramatic backlight, rooster tail of dust and dirt spray, dirt bike fully airborne, motion blur, shallow depth of field, warm orange and amber tones against a deep dark sky, professional sports photography, no text, no logos, ultra detailed",
  paddock:
    "Warm candid documentary photograph of a grassroots motocross paddock at dusk, families and crew gathered around pickup trucks and trailers, a grandfather and a young kid working on a dirt bike together, folding chairs and string lights, neighbors helping neighbors, golden evening light, sense of belonging and community, cinematic, no text, no logos, ultra detailed",
  mx:
    "Dynamic action photograph of a motocross rider hard on the throttle through a muddy bermed corner, dirt roost spraying, knobby tires digging in, low angle, motion blur, dramatic dusk lighting, warm tones, professional motorsport photography, no text, no logos, ultra detailed",
  car:
    "Action photograph of an amateur club road-racing car cornering hard on a race track at dusk, slight motion blur, heat haze, paddock garages blurred in background, cinematic warm and dark color grade, professional motorsport photography, no text, no logos, ultra detailed",
  frontline:
    "Atmospheric photograph of a beloved small-town short-track oval racetrack at dusk, empty grandstands and floodlights glowing warm, americana, a place worth protecting, cinematic, moody dark sky with warm amber light, no people, no text, no logos, ultra detailed",
  start:
    "Tense photograph of a motocross start gate moments before the drop, row of riders gripping handlebars, front wheels lined up, dust in the air, dramatic low golden-hour light, anticipation and energy, shallow depth of field, professional sports photography, no text, no logos, ultra detailed",

  // Per-discipline thumbnails for The Grid event cards
  "disc-motocross":
    "Action photograph of a motocross rider railing a dirt berm corner with a big rooster tail of dirt roost, knobby tires, dusk golden light, warm amber tones, motion blur, professional motorsport photography, no text, no logos, ultra detailed",
  "disc-off-road":
    "Action photograph of an off-road enduro dirt bike rider splashing through a muddy wooded trail, water and mud spray, dappled forest light, warm tones, motion blur, professional motorsport photography, no text, no logos, ultra detailed",
  "disc-autocross":
    "Action photograph of a small sports car weaving through an autocross cone course on open tarmac, tire smoke, cones blurred, dynamic low angle, dusk warm light, motion blur, professional motorsport photography, no text, no logos, ultra detailed",
  "disc-road-race":
    "Action photograph of an amateur road-racing car hard through a corner on a road course at dusk, curbing and apex, heat haze, warm dark color grade, motion blur, professional motorsport photography, no text, no logos, ultra detailed",
  "disc-endurance":
    "Atmospheric photograph of an endurance race car at night with bright headlights on track, pit lane glow in the background, long exposure light streaks, warm and moody, professional motorsport photography, no text, no logos, ultra detailed",
  "disc-short-track":
    "Action photograph of a short-track oval stock car sliding through a dirt corner under floodlights, dirt spray, grandstands blurred, warm dramatic night light, motion blur, professional motorsport photography, no text, no logos, ultra detailed",
  "disc-karting":
    "Action photograph of a racing kart cornering low to the ground on a kart track, dynamic close low angle, slight motion blur, dusk warm light, professional motorsport photography, no text, no logos, ultra detailed",
};

const img = new Hono<{ Bindings: Env; Variables: Vars }>();

function fallbackSvg() {
  // Carbon + ignition gradient with faint speed streaks — matches the brand.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
    <defs>
      <radialGradient id="g" cx="50%" cy="0%" r="90%">
        <stop offset="0%" stop-color="#1a0f0a"/>
        <stop offset="45%" stop-color="#0E1117"/>
        <stop offset="100%" stop-color="#07080B"/>
      </radialGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#g)"/>
    <g opacity="0.10" stroke="#FF4D14" stroke-width="3">
      ${Array.from({ length: 8 }, (_, i) => `<line x1="${-200 + i * 160}" y1="1024" x2="${200 + i * 160}" y2="0"/>`).join("")}
    </g>
  </svg>`;
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" },
  });
}

img.get("/:slug", async (c) => {
  const slug = c.req.param("slug").replace(/\.(jpg|jpeg|png|webp)$/, "");
  const prompt = PROMPTS[slug];
  if (!prompt) return c.notFound();

  const key = `gen/${slug}.jpg`;

  // Serve from cache if we've already generated it.
  const cached = await c.env.MEDIA.get(key);
  if (cached) {
    return new Response(cached.body, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "x-imt-cache": "hit",
      },
    });
  }

  // Generate on demand.
  try {
    const res = (await c.env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt,
      steps: 7,
    })) as { image?: string };
    if (!res?.image) return fallbackSvg();

    const bytes = Uint8Array.from(atob(res.image), (ch) => ch.charCodeAt(0));
    c.executionCtx.waitUntil(
      c.env.MEDIA.put(key, bytes, {
        httpMetadata: { contentType: "image/jpeg" },
      }),
    );
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "x-imt-cache": "miss",
      },
    });
  } catch (err) {
    console.error("image gen failed", slug, err);
    return fallbackSvg();
  }
});

export default img;
