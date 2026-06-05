import { useTranslation } from "../state/translation";

// Auto-detect banner: shown once to Spanish-language browsers who haven't
// chosen yet. Offers, never forces. Sits at the top of the page content.
export function TranslateOffer() {
  const { showOffer, setEnabled, dismissOffer } = useTranslation();
  if (!showOffer) return null;
  return (
    <div className="border-b border-ignition/25 bg-ignition/[0.08]">
      <div className="container-page flex flex-wrap items-center gap-3 py-2.5 text-sm">
        <span className="text-white/80">
          ¿Prefieres leer el contenido en <span className="font-semibold text-white">español</span>?
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setEnabled(true)} className="btn-primary btn-sm">
            Ver en español
          </button>
          <button
            onClick={dismissOffer}
            className="text-white/45 hover:text-white/80"
            aria-label="Keep English"
          >
            No, gracias
          </button>
        </div>
      </div>
    </div>
  );
}

// Persistent EN / ES toggle (footer). Lets anyone switch regardless of browser.
export function LangToggle() {
  const { enabled, setEnabled } = useTranslation();
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-white/10 text-[11px] font-semibold">
      <button
        onClick={() => setEnabled(false)}
        className={`px-2.5 py-1 transition ${enabled ? "text-white/45 hover:text-white/70" : "bg-white/10 text-white"}`}
      >
        EN
      </button>
      <button
        onClick={() => setEnabled(true)}
        className={`px-2.5 py-1 transition ${enabled ? "bg-ignition text-white" : "text-white/45 hover:text-white/70"}`}
      >
        ES
      </button>
    </div>
  );
}
