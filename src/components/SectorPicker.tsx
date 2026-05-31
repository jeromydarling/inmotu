import { SECTORS, type SectorId } from "@shared/types";

// The sector chooser — shown at onboarding and editable in settings. Multi-
// select: a family can follow more than one community (e.g. MX + karting).
// Drives adaptive vocabulary and which venue categories surface on the map.

const ORDER: SectorId[] = [
  "motocross",
  "bmx",
  "drag",
  "karting_sprint",
  "karting_dirt",
  "roadrace",
  "autocross",
];

const ACCENT: Record<SectorId, string> = {
  motocross: "#22C55E",
  bmx: "#FF4D14",
  drag: "#3B82F6",
  karting_sprint: "#A855F7",
  karting_dirt: "#F59E0B",
  roadrace: "#FF4D14",
  autocross: "#94A3B8",
};

export function SectorPicker({
  value,
  onChange,
  columns = 2,
}: {
  value: SectorId[];
  onChange: (next: SectorId[]) => void;
  columns?: number;
}) {
  function toggle(id: SectorId) {
    onChange(value.includes(id) ? value.filter((s) => s !== id) : [...value, id]);
  }

  return (
    <div className={`grid gap-3 ${columns === 1 ? "" : "sm:grid-cols-2"}`}>
      {ORDER.map((id) => {
        const s = SECTORS[id];
        const on = value.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
              on
                ? "border-white/30 bg-white/[0.08]"
                : "border-white/[0.08] bg-carbon-850 hover:border-white/20"
            }`}
          >
            <span
              className="absolute inset-y-0 left-0 w-1"
              style={{ background: ACCENT[id], opacity: on ? 1 : 0.35 }}
            />
            <div className="flex items-center justify-between gap-2 pl-2">
              <span className="font-display text-lg font-bold text-white">{s.label}</span>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  on ? "border-flag-green bg-flag-green text-carbon-950" : "border-white/20 text-transparent"
                }`}
              >
                ✓
              </span>
            </div>
            <p className="mt-1 pl-2 text-sm text-white/55">{s.tagline}</p>
          </button>
        );
      })}
    </div>
  );
}
