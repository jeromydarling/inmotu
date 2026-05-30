import { Hono } from "hono";
import type { Env, Vars } from "../types";

// AI-generated imagery, cached in R2. Images are produced once by Workers AI
// (FLUX.1 schnell) on first request, stored, then served from R2 forever.
// A gradient SVG is returned if generation isn't ready yet, so the page never
// shows a broken image while the photographic layer warms up.

const PROMPTS: Record<string, string> = {
  hero:
    "Vivid high-contrast action photograph of a youth motocross rider launching a big dirt jump, dirt bike fully airborne and tipped sideways in a whip, bright golden-hour sunlight, vibrant glowing orange dust spray catching the light, dramatic but bright and clearly lit sky, sharp focus on the rider, energetic and triumphant, professional sports photography, vibrant colors, no text, no logos, ultra detailed",
  paddock:
    "Warm, bright candid documentary photograph of a grassroots motocross paddock in early evening, families and crew gathered around pickup trucks and trailers, a grandfather and a young kid working on a dirt bike together, string lights glowing, neighbors helping neighbors, warm inviting golden light, clearly lit and vibrant, sense of belonging and community, cinematic, no text, no logos, ultra detailed",
  mx:
    "Bright dynamic action photograph of a motocross rider hard on the throttle through a bermed corner, vibrant orange dirt roost spraying in sunlight, knobby tires digging in, low angle, motion blur, warm sunny golden-hour light, vivid colors, professional motorsport photography, no text, no logos, ultra detailed",
  car:
    "Bright action photograph of an amateur club road-racing car cornering hard on a race track in warm evening light, slight motion blur, vivid colors, paddock garages blurred in background, clearly lit cinematic color grade, professional motorsport photography, no text, no logos, ultra detailed",
  frontline:
    "Atmospheric but clearly lit photograph of a beloved small-town short-track oval racetrack at dusk, grandstands and floodlights glowing warm and bright, americana, a place worth protecting, warm amber glow against a colorful sunset sky, vibrant, no people, no text, no logos, ultra detailed",
  start:
    "Bright tense photograph of a motocross start gate moments before the drop, row of riders gripping handlebars, front wheels lined up, dust glowing in warm sunlight, dramatic but well-lit golden-hour light, anticipation and energy, vivid colors, professional sports photography, no text, no logos, ultra detailed",

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

  // Bump VERSION to regenerate every image with updated prompts (R2 key changes).
  const VERSION = "v2";
  const key = `gen/${VERSION}/${slug}.jpg`;

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
