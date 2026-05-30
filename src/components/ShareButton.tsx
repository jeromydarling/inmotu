import { useState } from "react";
import { useToast } from "../state/toast";

/**
 * Native share on mobile (Web Share API → opens the OS share sheet), with a
 * copy-link fallback on desktop. The single most viral primitive we have.
 */
export function ShareButton({
  title,
  text,
  url,
  className = "btn-primary",
  label = "Share",
}: {
  title: string;
  text?: string;
  url?: string;
  className?: string;
  label?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  async function share() {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title, text, url: shareUrl });
        return;
      } catch {
        // user canceled or share failed — fall through to menu
      }
    }
    setOpen((v) => !v);
  }

  function copy() {
    navigator.clipboard?.writeText(shareUrl).then(
      () => toast.success("Link copied."),
      () => toast.error("Couldn't copy."),
    );
    setOpen(false);
  }

  const enc = encodeURIComponent;
  const links: [string, string][] = [
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`],
    ["X / Twitter", `https://twitter.com/intent/tweet?url=${enc(shareUrl)}&text=${enc(text || title)}`],
    ["Email", `mailto:?subject=${enc(title)}&body=${enc((text ? text + "\n\n" : "") + shareUrl)}`],
  ];

  return (
    <div className="relative inline-block">
      <button onClick={share} className={className}>
        <span aria-hidden>↗</span> {label}
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-2 w-44 rounded-xl border border-white/10 bg-carbon-850 p-1.5 shadow-panel">
          <button onClick={copy} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/75 hover:bg-white/[0.06]">
            Copy link
          </button>
          {links.map(([name, href]) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-white/75 hover:bg-white/[0.06]"
            >
              {name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
