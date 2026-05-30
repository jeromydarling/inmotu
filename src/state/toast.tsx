import { createContext, useContext, useState, type ReactNode } from "react";

type Tone = "error" | "success" | "info";
interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

interface ToastCtx {
  push: (message: string, tone?: Tone) => void;
  error: (message: string) => void;
  success: (message: string) => void;
}

const Ctx = createContext<ToastCtx>(null!);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (message: string, tone: Tone = "info") => {
    const id = nextId++;
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  };

  const value: ToastCtx = {
    push,
    error: (m) => push(m, "error"),
    success: (m) => push(m, "success"),
  };

  const tones: Record<Tone, string> = {
    error: "border-flag-red/40 bg-flag-red/15 text-flag-red",
    success: "border-flag-green/40 bg-flag-green/15 text-flag-green",
    info: "border-white/15 bg-carbon-800/90 text-white/80",
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-md animate-fade-up rounded-xl border px-4 py-3 text-sm font-medium shadow-panel backdrop-blur ${tones[t.tone]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
