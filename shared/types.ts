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
}

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
  progress_id?: string | null;
  event_id?: string | null;
  result_pos?: number | null;
  advanced?: number;
  recorded_at?: number | null;
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
