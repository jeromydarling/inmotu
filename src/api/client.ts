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
