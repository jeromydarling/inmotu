import { Link } from "react-router-dom";
import type { EventItem } from "@shared/types";
import { fmtDateShort, fmtMoney, daysUntil, titleCase } from "../lib/format";
import { Badge } from "./ui";

const levelTone: Record<string, "live" | "amber" | "green" | "default"> = {
  national: "live",
  regional: "amber",
  qualifier: "amber",
  beginner: "green",
  club: "default",
};

export function EventCard({
  e,
  onSave,
}: {
  e: EventItem;
  onSave?: (e: EventItem) => void;
}) {
  const d = fmtDateShort(e.starts_at);
  const regClose = daysUntil(e.reg_closes_at);
  const deadlineSoon = regClose != null && regClose >= 0 && regClose <= 7;

  return (
    <div className="panel group relative flex gap-4 p-4 transition hover:border-ignition/30">
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-carbon-900 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ignition">{d.mon}</span>
        <span className="font-display text-2xl font-extrabold leading-none text-white">{d.day}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {e.level && <Badge tone={levelTone[e.level] ?? "default"}>{e.level}</Badge>}
          {e.discipline && <Badge tone="muted">{titleCase(e.discipline)}</Badge>}
          {deadlineSoon && (
            <Badge tone="red">
              <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-flag-red" />
              Reg closes {regClose}d
            </Badge>
          )}
        </div>

        <Link to={`/events/${e.slug}`} className="block">
          <h3 className="truncate font-display text-base font-bold text-white group-hover:text-ignition-300">
            {e.title}
          </h3>
        </Link>
        <p className="mt-0.5 truncate text-sm text-white/50">
          {e.track_name ?? "Venue TBD"}
          {e.track_state ? ` · ${e.track_city}, ${e.track_state}` : ""}
          {e.region ? ` · ${e.region}` : ""}
        </p>

        <div className="mt-2 flex items-center gap-3 text-xs text-white/40">
          {e.entry_fee_cents != null && <span>Entry {fmtMoney(e.entry_fee_cents)}</span>}
          {e.body_slug && <span className="uppercase">{e.body_slug}</span>}
        </div>
      </div>

      {onSave && (
        <button
          onClick={() => onSave(e)}
          aria-label={e.saved ? "Remove from calendar" : "Save to calendar"}
          className={`absolute right-3 top-3 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
            e.saved
              ? "border-ignition/40 bg-ignition/15 text-ignition-300"
              : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white"
          }`}
        >
          {e.saved ? "★ Saved" : "☆ Save"}
        </button>
      )}
    </div>
  );
}
