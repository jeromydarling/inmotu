import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";

// Content translation (Workers AI). We translate dynamic content on demand and
// remember the reader's choice. Auto-detects Spanish browsers and *offers* a
// switch (never forces it). UI chrome stays English — this is content-only.

const TARGET = "es"; // only language today
const STORE_KEY = "inmotu_lang"; // "es" | "en"

interface TranslationCtx {
  enabled: boolean; // is content being shown translated?
  target: string;
  showOffer: boolean; // show the auto-detect "Ver en español" banner?
  setEnabled: (on: boolean) => void;
  dismissOffer: () => void;
}

const Ctx = createContext<TranslationCtx>({
  enabled: false,
  target: TARGET,
  showOffer: false,
  setEnabled: () => {},
  dismissOffer: () => {},
});

// Module-level cache (survives route changes): original string → translation.
const memo = new Map<string, string>();

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [showOffer, setShowOffer] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === "es") {
      setEnabledState(true);
    } else if (!saved && navigator.language?.toLowerCase().startsWith("es")) {
      // Spanish browser, no choice made yet → offer it.
      setShowOffer(true);
    }
  }, []);

  const setEnabled = (on: boolean) => {
    setEnabledState(on);
    setShowOffer(false);
    localStorage.setItem(STORE_KEY, on ? "es" : "en");
  };
  const dismissOffer = () => {
    setShowOffer(false);
    localStorage.setItem(STORE_KEY, "en");
  };

  return (
    <Ctx.Provider value={{ enabled, target: TARGET, showOffer, setEnabled, dismissOffer }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTranslation = () => useContext(Ctx);

/**
 * Translate a batch of strings. Returns the originals until translation is on
 * and ready, then swaps to translated (cached across the app). Pass the whole
 * list a page needs so it's one network call, not one per item.
 */
export function useTranslate(texts: string[]): string[] {
  const { enabled, target } = useTranslation();
  const [, force] = useState(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const key = texts.join("");
  useEffect(() => {
    if (!enabled) return;
    const missing = [...new Set(texts.map((t) => (t ?? "").trim()).filter(Boolean))].filter(
      (t) => !memo.has(`${target}:${t}`),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    api
      .translate(missing, target)
      .then(({ translations }) => {
        if (cancelled) return;
        missing.forEach((t, i) => memo.set(`${target}:${t}`, translations[i] ?? t));
        if (mounted.current) force((n) => n + 1);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, target]);

  if (!enabled) return texts;
  return texts.map((t) => {
    const k = (t ?? "").trim();
    return k ? memo.get(`${target}:${k}`) ?? t : t;
  });
}
