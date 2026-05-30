import type { Env } from "../types";

interface MetaInput {
  title: string;
  description: string;
  url: string;
  image: string; // absolute URL
  jsonLd?: Record<string, unknown>;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Fetch the SPA index.html from ASSETS and inject SEO/social meta tags into
 * <head> so shared links and crawlers get rich previews. The SPA still boots
 * normally and hydrates the real content client-side.
 */
export async function renderWithMeta(env: Env, req: Request, m: MetaInput): Promise<Response> {
  // Grab the built index.html (root) from the asset handler.
  const shell = await env.ASSETS.fetch(new Request(new URL("/", req.url)));
  let html = await shell.text();

  const tags = [
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${esc(m.url)}" />`,
    `<meta property="og:image" content="${esc(m.image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${esc(m.image)}" />`,
    `<meta name="description" content="${esc(m.description)}" />`,
    m.jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(m.jsonLd).replace(/</g, "\\u003c")}</script>`
      : "",
  ].join("\n    ");

  // Drop the static OG/Twitter/description tags from index.html so ours are
  // authoritative, then replace <title> and inject before </head>.
  html = html
    .replace(/\s*<meta\s+property="og:[^"]*"[^>]*>/g, "")
    .replace(/\s*<meta\s+name="twitter:[^"]*"[^>]*>/g, "")
    .replace(/\s*<meta\s+name="description"[^>]*>/g, "");
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`);
  html = html.replace("</head>", `    ${tags}\n  </head>`);

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
