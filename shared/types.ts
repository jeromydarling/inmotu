// Shared API contract types — imported by both the Worker and the SPA.

export type Plan = "free" | "family" | "pro" | "tower";
export type Role = "member" | "operator" | "admin";

export interface PublicUser {
  id: string;
  email: string;
  full_name: string;
  home_region: string | null;
  zip: string | null;
  plan: Plan;
  role: Role;
  sectors: SectorId[]; // chosen at onboarding; adapts vocabulary + features
}

// ── Sectors ──────────────────────────────────────────────────────────────────
// A "sector" is the racing community a family belongs to. It adapts the
// product's vocabulary, progression model, and which venue categories surface.
// Canonical, shared by Worker + SPA so copy never drifts between them.

export type SectorId =
  | "motocross"
  | "roadrace"
  | "autocross"
  | "karting_sprint"
  | "karting_dirt"
  | "bmx"
  | "drag";

/** How a sector models a competitor's path — drives the "ladder" UX. */
export type ProgressionModel = "ladder" | "track_points" | "open";

export interface SectorDef {
  id: SectorId;
  label: string; // short pill label
  tagline: string; // one line for the picker
  /** venue categories (see venues.category) this sector cares about */
  venueCategories: string[];
  /** event/track discipline slugs this sector maps to (for filtering The Grid) */
  disciplines: string[];
  progression: ProgressionModel;
  /** the words this community actually uses — never show generic terms instead */
  vocab: {
    event: string; // what a race weekend/meet is called
    session: string; // a single run/heat
    final: string; // the climactic race
    standings: string; // the ranking metric
    competitor: string; // a participant
    ladderName?: string; // name of the road-to-the-top, if any
  };
  /** values/phrases that signal we genuinely understand them */
  voice: string[];
}

export const SECTORS: Record<SectorId, SectorDef> = {
  motocross: {
    id: "motocross",
    label: "Motocross",
    tagline: "Gates drop, the whole family's at the track.",
    venueCategories: ["motocross"],
    disciplines: ["motocross", "off-road"],
    progression: "ladder",
    vocab: { event: "race", session: "moto", final: "main", standings: "points", competitor: "rider", ladderName: "Road to the Ranch" },
    voice: ["the gate drops", "moto", "the main", "pass it down"],
  },
  roadrace: {
    id: "roadrace",
    label: "Road Racing",
    tagline: "Apexes, track days, and wheel-to-wheel.",
    venueCategories: ["road"],
    disciplines: ["road-race", "endurance"],
    progression: "track_points",
    vocab: { event: "race weekend", session: "session", final: "feature", standings: "championship", competitor: "driver" },
    voice: ["apex", "track day", "wheel-to-wheel", "the esses"],
  },
  autocross: {
    id: "autocross",
    label: "Autocross",
    tagline: "Cones, classes, and your own best time.",
    venueCategories: ["road"],
    disciplines: ["autocross"],
    progression: "track_points",
    vocab: { event: "event", session: "run", final: "final run", standings: "PAX/class", competitor: "driver" },
    voice: ["clean run", "coned it", "PAX", "raw time"],
  },
  karting_sprint: {
    id: "karting_sprint",
    label: "Sprint Karting",
    tagline: "LO206 to shifters — where champions start.",
    venueCategories: ["karting", "road"],
    disciplines: ["karting"],
    progression: "open",
    vocab: { event: "race", session: "heat", final: "final", standings: "points", competitor: "driver" },
    voice: ["LO206", "sealed engine", "the grid", "prefinal", "where champions start"],
  },
  karting_dirt: {
    id: "karting_dirt",
    label: "Dirt-Oval Karting",
    tagline: "Hot laps, heats, and the feature on clay.",
    venueCategories: ["karting", "oval"],
    disciplines: ["karting", "short-track"],
    progression: "track_points",
    vocab: { event: "race", session: "heat", final: "feature", standings: "points", competitor: "driver" },
    voice: ["hot laps", "the feature", "pill draw", "the cushion", "LO206"],
  },
  bmx: {
    id: "bmx",
    label: "BMX Racing",
    tagline: "From the balance-bike moto to the Grands.",
    venueCategories: ["bmx"],
    disciplines: ["bmx"],
    progression: "ladder",
    vocab: { event: "race", session: "moto", final: "main", standings: "NAG points", competitor: "rider", ladderName: "Road to the #1 Plate" },
    voice: ["moto", "the main", "gate pick", "transfer", "NAG plate", "Gold Cup", "the Grands"],
  },
  drag: {
    id: "drag",
    label: "Drag Racing",
    tagline: "Cut a light, nail the dial, win Saturday night.",
    venueCategories: ["drag"],
    disciplines: ["drag"],
    progression: "track_points",
    vocab: { event: "race", session: "time trial", final: "final round", standings: "track points", competitor: "racer", ladderName: "Track Points to Vegas" },
    voice: ["the tree", "dial-in", "time slip", "the eighth-mile", "Jr. Dragster", "run what ya brung"],
  },
};

export interface Track {
  id: string;
  slug: string;
  name: string;
  discipline: string | null;
  surface: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  amenities: string[];
  website: string | null;
  status: "active" | "endangered" | "closed";
}

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  discipline: string | null;
  body_slug: string | null;
  track_id: string | null;
  track_name?: string | null;
  track_city?: string | null;
  track_state?: string | null;
  region: string | null;
  level: string | null;
  age_group: string | null;
  starts_at: number;
  ends_at: number | null;
  reg_opens_at: number | null;
  reg_closes_at: number | null;
  entry_fee_cents: number | null;
  gate_fee_cents: number | null;
  external_url: string | null;
  source: string;
  ladder_id: string | null;
  saved?: boolean;
}

export interface Rider {
  id: string;
  user_id: string;
  name: string;
  birthdate: string | null;
  discipline: string | null;
  race_class: string | null;
  number: string | null;
  ama_license: string | null;
  skill_level: string | null;
}

export interface Legislation {
  id: string;
  state: string;
  state_name: string;
  bill_number: string | null;
  title: string;
  summary: string | null;
  status: "introduced" | "committee" | "passed" | "enacted" | "failed";
  url: string | null;
  supporters?: number;
  supported?: boolean;
}

export interface ApiError {
  error: string;
  message?: string;
}

// ── Additional read-model shapes returned by the API ──────────────────
export interface Threat {
  id: string;
  threat_type: string;
  description: string | null;
  verified: number;
  created_at?: number;
}

export interface LadderStage {
  id: string;
  ladder_id: string;
  name: string;
  stage_order: number;
  region: string | null;
  advance_note?: string | null;
  pos_advances?: number | null;
  progress_id?: string | null;
  event_id?: string | null;
  result_pos?: number | null;
  advanced?: number;
  recorded_at?: number | null;
}

export interface Ladder {
  id: string;
  name: string;
  discipline: string | null;
  season: number;
  progression?: "ladder" | "track_points";
}

export interface BudgetRow {
  category: string;
  total: number;
}

export interface MaintenanceLog {
  id: string;
  rider_id: string;
  rider_name?: string;
  performed_at: number;
  hours: number | null;
  item: string;
  notes: string | null;
  cost_cents: number | null;
}

export interface Sponsor {
  id: string;
  user_id: string;
  name: string;
  tier: string | null;
  amount_cents: number | null;
  deliverables: string | null; // JSON: {text,done}[]
  renewal_at: number | null;
  status: "prospect" | "active" | "expired";
}

export interface Photo {
  id: string;
  rider_id: string | null;
  event_id: string | null;
  caption: string | null;
  taken_at: number | null;
  created_at: number;
}

export interface YearbookOrder {
  id: string;
  rider_id: string | null;
  rider_name?: string | null;
  season: number;
  title: string | null;
  status: "draft" | "paid" | "submitted" | "printed" | "shipped" | "canceled";
  photo_count: number;
  amount_cents: number | null;
}

export interface Series {
  id: string;
  slug: string;
  name: string;
  discipline: string | null;
  season: number;
  rounds?: number;
}

export interface Standing {
  competitor: string;
  race_class: string | null;
  points: number;
  rounds: number;
  best: number;
}

export interface Setup {
  id: string;
  label: string;
  conditions: string | null;
  track_name?: string | null;
  data: string | null; // JSON
  created_at: number;
}

export interface StintPlan {
  id: string;
  name: string;
  race_minutes: number;
  stint_minutes: number;
  fuel_minutes: number;
  drivers: string | null;
  created_at: number;
}

export interface Update {
  id: string;
  title: string;
  body: string;
  urgent: number;
  created_at: number;
  event_title: string;
  event_slug: string;
}

export interface Rule {
  id: string;
  discipline: string | null;
  body_slug: string | null;
  category: string;
  title: string;
  summary: string;
  url: string | null;
  season: number | null;
}

export interface TowerEvent extends EventItem {
  track_name?: string | null;
  reg_count: number;
}

export interface Registration {
  id: string;
  rider_name: string;
  race_class: string | null;
  status: string;
  amount_cents: number | null;
  travel_miles?: number | null;
}

export interface ImpactSummary {
  entries: number;
  gross_cents: number;
  avg_miles: number;
  economic_impact_cents: number;
}

export interface Discipline {
  slug: string;
  label: string;
  kind: "moto" | "car";
}

export interface PlanInfo {
  id: string;
  label: string;
  price: string;
}
