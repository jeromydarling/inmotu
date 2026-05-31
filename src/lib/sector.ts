import { SECTORS, type SectorDef, type SectorId } from "@shared/types";

// Adaptive vocabulary. Given a user's chosen sectors, resolve the right words
// to show ("moto" vs "session", "main" vs "feature", the ladder's real name).
// Falls back to a sensible generic when no sector is set.

const GENERIC: SectorDef["vocab"] = {
  event: "event",
  session: "session",
  final: "final",
  standings: "standings",
  competitor: "racer",
};

/** The user's primary sector definition (first chosen), or null. */
export function primarySector(sectors: SectorId[] | undefined): SectorDef | null {
  if (!sectors || sectors.length === 0) return null;
  return SECTORS[sectors[0]] ?? null;
}

/** Resolve display vocabulary for a user's sectors. */
export function vocab(sectors: SectorId[] | undefined): SectorDef["vocab"] {
  return primarySector(sectors)?.vocab ?? GENERIC;
}

/** The venue categories relevant to a user's sectors (union); empty = all. */
export function sectorVenueCategories(sectors: SectorId[] | undefined): string[] {
  if (!sectors || sectors.length === 0) return [];
  const set = new Set<string>();
  for (const id of sectors) SECTORS[id]?.venueCategories.forEach((c) => set.add(c));
  return [...set];
}

/** The event/track discipline slugs relevant to a user's sectors; empty = all. */
export function sectorDisciplines(sectors: SectorId[] | undefined): string[] {
  if (!sectors || sectors.length === 0) return [];
  const set = new Set<string>();
  for (const id of sectors) SECTORS[id]?.disciplines.forEach((d) => set.add(d));
  return [...set];
}
