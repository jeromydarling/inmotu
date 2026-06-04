import type { Env } from "../types";

// Transactional email via the Cloudflare Email Sending binding (env.EMAIL).
// No API key — the inmotu.pro domain is onboarded with DNS configured. Falls
// back gracefully (logs + returns false) if the binding isn't present, so the
// app never throws on a missing email channel.

const DEFAULT_FROM = "inmotu <noreply@inmotu.pro>";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Low-level send. Returns true on success, false if unavailable/failed. */
export async function sendMail(
  env: Env,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  const from = env.EMAIL_FROM || DEFAULT_FROM;
  if (!env.EMAIL) {
    console.warn("EMAIL binding not configured — skipping send to", to);
    return false;
  }
  try {
    await env.EMAIL.send({ from, to, subject, html, text });
    return true;
  } catch (e) {
    console.error("email send failed", e);
    return false;
  }
}

// ── Branded layout ───────────────────────────────────────────────────────────

/** Wrap body HTML in the inmotu shell (dark header, ignition accent). */
function shell(heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<tr><td style="padding:8px 0 24px">
         <a href="${cta.url}" style="display:inline-block;background:#E63A05;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${escapeHtml(cta.label)}</a>
       </td></tr>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#0A0C11;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0C11;padding:28px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#12151C;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden">
          <tr><td style="padding:20px 28px;border-bottom:1px solid rgba(255,255,255,.06)">
            <span style="font-weight:800;font-size:20px;color:#fff;letter-spacing:-.02em">in<span style="color:#E63A05">motu</span></span>
          </td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 12px;color:#fff;font-size:22px;letter-spacing:-.02em">${escapeHtml(heading)}</h1>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="color:rgba(255,255,255,.7);font-size:15px;line-height:1.55">${bodyHtml}</td></tr>${button}</table>
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.35);font-size:12px">
            inmotu — grassroots motorsports, in motion. If you didn't expect this email, you can ignore it.
          </td></tr>
        </table>
      </td></tr>
    </table></body></html>`;
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function sendWelcome(env: Env, to: string, name: string): Promise<boolean> {
  const first = escapeHtml(name.split(" ")[0] || "racer");
  const url = `${env.APP_URL}/app`;
  return sendMail(
    env,
    to,
    "Welcome to inmotu 🏁",
    shell(
      `Welcome, ${first}!`,
      `<p style="margin:0 0 12px">You're in. inmotu is one home for the whole racing family — the calendar, your riders, the ladder, and the people who pull in beside you.</p>
       <p style="margin:0 0 4px">Set up your paddock and find what's racing near you.</p>`,
      { label: "Open my paddock →", url },
    ),
    `Welcome, ${name.split(" ")[0] || "racer"}! You're in. Set up your paddock: ${url}`,
  );
}

export async function sendVerifyEmail(env: Env, to: string, token: string): Promise<boolean> {
  const url = `${env.APP_URL}/verify?token=${encodeURIComponent(token)}`;
  return sendMail(
    env,
    to,
    "Confirm your email · inmotu",
    shell(
      "Confirm your email",
      `<p style="margin:0 0 12px">Tap below to confirm this is your email address. This keeps your account secure and unlocks deadline reminders for the races you save.</p>
       <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,.45)">This link expires in 48 hours.</p>`,
      { label: "Confirm my email →", url },
    ),
    `Confirm your inmotu email: ${url} (expires in 48 hours)`,
  );
}

export async function sendPasswordReset(env: Env, to: string, token: string): Promise<boolean> {
  const url = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return sendMail(
    env,
    to,
    "Reset your inmotu password",
    shell(
      "Reset your password",
      `<p style="margin:0 0 12px">We got a request to reset your inmotu password. Tap below to choose a new one.</p>
       <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,.45)">This link expires in 1 hour. If you didn't ask for this, ignore this email — your password won't change.</p>`,
      { label: "Reset my password →", url },
    ),
    `Reset your inmotu password: ${url} (expires in 1 hour). If you didn't request this, ignore it.`,
  );
}

/** Generic notification email (used by the notify fan-out). */
export async function sendNotification(
  env: Env,
  to: string,
  title: string,
  body: string | undefined,
  href: string | undefined,
): Promise<boolean> {
  const url = `${env.APP_URL}${href ?? "/app"}`;
  return sendMail(
    env,
    to,
    title,
    shell(title, body ? `<p style="margin:0 0 12px">${escapeHtml(body)}</p>` : "", { label: "Open inmotu →", url }),
    `${title}${body ? `\n\n${body}` : ""}\n\n${url}`,
  );
}
