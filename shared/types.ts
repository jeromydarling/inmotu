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
}
