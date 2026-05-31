import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

export function NotificationBell() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const r = await api.notifications();
      setItems(r.notifications);
      setUnread(r.unread);
    } catch {
      /* not signed in / offline — ignore */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // light poll
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function openMenu() {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      await api.markRead().catch(() => {});
      setUnread(0);
      setItems((p) => p.map((n) => ({ ...n, read: 1 })));
    }
  }

  function go(n: any) {
    setOpen(false);
    if (n.href) nav(n.href);
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={openMenu} className="btn-ghost btn-sm relative" aria-label="Notifications">
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ignition px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-carbon-850 shadow-panel">
          <div className="border-b border-white/[0.06] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white/50">
            Notifications
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-white/40">You're all caught up. 🏁</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => go(n)}
                  className="block w-full border-b border-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{icon(n.kind)}</span>
                    <span className="text-sm font-semibold text-white">{n.title}</span>
                  </div>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-white/55">{n.body}</p>}
                </button>
              ))
            )}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              nav("/app/settings");
            }}
            className="block w-full px-4 py-2.5 text-center text-xs font-semibold text-ignition hover:bg-white/[0.04]"
          >
            Notification settings
          </button>
        </div>
      )}
    </div>
  );
}

function icon(kind: string): string {
  return kind === "deadline" ? "⏰" : kind === "announcement" ? "📣" : kind === "ladder" ? "🏁" : "🔔";
}
