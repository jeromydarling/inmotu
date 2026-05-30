import { Link } from "react-router-dom";
import type { EventItem } from "@shared/types";
import { fmtDateShort, fmtMoney, daysUntil, titleCase } from "../lib/format";
import { Badge } from "./ui";
import { AiImage } from "./motion";

const levelTone: Record<string, "live" | "amber" | "green" | "default"> = {
  national: "live",
  regional: "amber",
  qualifier: "amber",
  beginner: "green",
  club: "default",
};

const KNOWN_DISCIPLINES = new Set([
  "motocross",
  "off-road",
  "autocross",
  "road-race",
  "endurance",
  "short-track",
  "karting",
]);

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
  const thumb = e.discipline && KNOWN_DISCIPLINES.has(e.discipline) ? `disc-${e.discipline}` : "start";

  return (
    <div className="panel group relative flex gap-4 overflow-hidden p-3 transition hover:border-ignition/30">
      {/* Discipline thumbnail with the date overlaid */}
      <Link to={`/events/${e.slug}`} className="relative h-28 w-24 shrink-0 sm:w-28">
        <AiImage
          slug={thumb}
          kenBurns
          className="h-full w-full rounded-xl border border-white/10"
          imgClassName="transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute bottom-2 left-2 flex flex-col items-center rounded-lg border border-white/10 bg-carbon-950/80 px-2 py-1 backdrop-blur">
          <span className="text-[10px] font-bold uppercase leading-none tracking-wide text-ignition">{d.mon}</span>
          <span className="font-display text-xl font-extrabold leading-none text-white">{d.day}</span>
        </div>
      </Link>

      <div className="min-w-0 flex-1 py-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 pr-16">
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
          className={`absolute right-3 top-3 z-10 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
            e.saved
              ? "border-ignition/40 bg-ignition/15 text-ignition-300"
              : "border-white/10 bg-carbon-950/70 text-white/50 backdrop-blur hover:text-white"
          }`}
        >
          {e.saved ? "★ Saved" : "☆ Save"}
        </button>
      )}
    </div>
  );
}
