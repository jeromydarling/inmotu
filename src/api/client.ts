import type {
  PublicUser,
  EventItem,
  Track,
  Rider,
  Legislation,
} from "@shared/types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error((data as any).error || res.statusText), {
      status: res.status,
      data,
    });
  }
  return data as T;
}

export const api = {
  // auth
  me: () => req<{ user: PublicUser | null }>("/auth/me"),
  login: (email: string, password: string) =>
    req<{ user: PublicUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (body: Record<string, unknown>) =>
    req<{ user: PublicUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () => req<{ ok: true }>("/auth/logout", { method: "POST" }),

  // grid
  events: (params: Record<string, string> = {}) =>
    req<{ events: EventItem[] }>(`/events?${new URLSearchParams(params)}`),
  event: (slug: string) => req<{ event: EventItem & Record<string, unknown> }>(`/events/${slug}`),
  toggleSave: (id: string) =>
    req<{ saved: boolean }>(`/events/${id}/save`, { method: "POST" }),
  savedEvents: () => req<{ events: EventItem[] }>("/events/saved/mine"),

  // tracks
  tracks: (params: Record<string, string> = {}) =>
    req<{ tracks: Track[] }>(`/tracks?${new URLSearchParams(params)}`),
  track: (slug: string) =>
    req<{ track: Track; events: any[]; threats: any[] }>(`/tracks/${slug}`),

  // riders / pit board
  riders: () => req<{ riders: Rider[] }>("/riders"),
  createRider: (body: Record<string, unknown>) =>
    req<{ rider: Rider }>("/riders", { method: "POST", body: JSON.stringify(body) }),
  deleteRider: (id: string) =>
    req<{ ok: true }>(`/riders/${id}`, { method: "DELETE" }),
  budgetSummary: () =>
    req<{ summary: { category: string; total: number }[] }>("/riders/budget/summary"),
  addBudget: (body: Record<string, unknown>) =>
    req<{ ok: true }>("/riders/budget", { method: "POST", body: JSON.stringify(body) }),

  // advocacy
  legislation: (params: Record<string, string> = {}) =>
    req<{ legislation: Legislation[] }>(`/advocacy/legislation?${new URLSearchParams(params)}`),
  endangered: () => req<{ tracks: any[] }>("/advocacy/endangered"),
  support: (kind: string, target_type: string, target_id: string) =>
    req<{ ok: true; supporters: number }>("/advocacy/support", {
      method: "POST",
      body: JSON.stringify({ kind, target_type, target_id }),
    }),

  // registration
  registerForEvent: (id: string, body: Record<string, unknown>) =>
    req<{ ok: true }>(`/events/${id}/register`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  myRegistrations: () =>
    req<{ registrations: any[] }>("/events/registrations/mine"),

  // tower (operator)
  towerEvents: () => req<{ events: any[] }>("/tower/events"),
  createTowerEvent: (body: Record<string, unknown>) =>
    req<{ event: any }>("/tower/events", { method: "POST", body: JSON.stringify(body) }),
  towerRegistrations: (id: string) =>
    req<{ registrations: any[]; impact: any }>(`/tower/events/${id}/registrations`),

  // garage (team ops)
  setups: () => req<{ setups: any[] }>("/garage/setups"),
  createSetup: (body: Record<string, unknown>) =>
    req<{ ok: true; id: string }>("/garage/setups", { method: "POST", body: JSON.stringify(body) }),
  deleteSetup: (id: string) =>
    req<{ ok: true }>(`/garage/setups/${id}`, { method: "DELETE" }),
  stints: () => req<{ plans: any[] }>("/garage/stints"),
  createStint: (body: Record<string, unknown>) =>
    req<{ ok: true; id: string }>("/garage/stints", { method: "POST", body: JSON.stringify(body) }),
  deleteStint: (id: string) =>
    req<{ ok: true }>(`/garage/stints/${id}`, { method: "DELETE" }),

  // ladder (Road to the Ranch)
  ladders: () => req<{ ladders: any[] }>("/ladder"),
  riderLadder: (riderId: string) =>
    req<{ rider: any; ladder: any; stages: any[] }>(`/ladder/rider/${riderId}`),
  recordLadder: (body: Record<string, unknown>) =>
    req<{ ok: true }>("/ladder/progress", { method: "POST", body: JSON.stringify(body) }),
  clearLadder: (id: string) =>
    req<{ ok: true }>(`/ladder/progress/${id}`, { method: "DELETE" }),

  // photos
  photos: (params: Record<string, string> = {}) =>
    req<{ photos: any[] }>(`/photos?${new URLSearchParams(params)}`),
  uploadPhoto: (fd: FormData) =>
    fetch("/api/photos", { method: "POST", credentials: "include", body: fd }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any).error || "Upload failed");
      return d as { photo: any };
    }),
  deletePhoto: (id: string) =>
    req<{ ok: true }>(`/photos/${id}`, { method: "DELETE" }),

  // yearbook
  yearbooks: () => req<{ orders: any[] }>("/yearbook"),
  createYearbook: (body: Record<string, unknown>) =>
    req<{ order: any }>("/yearbook", { method: "POST", body: JSON.stringify(body) }),
  yearbookCheckout: (id: string) =>
    req<{ url: string }>(`/yearbook/${id}/checkout`, { method: "POST" }),

  // config
  config: () => req<{ mapbox_token: string | null; app_url: string }>("/meta/config"),

  // meta + billing
  reference: () =>
    req<{ disciplines: any[]; bodies: any[]; regions: string[] }>("/meta/reference"),
  stats: () => req<{ stats: Record<string, number> }>("/meta/stats"),
  plans: () => req<{ plans: { id: string; label: string; price: string }[] }>("/billing/plans"),
  checkout: (plan: string) =>
    req<{ url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),
};
