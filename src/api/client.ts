import type {
  PublicUser,
  EventItem,
  Track,
  Rider,
  Legislation,
  Threat,
  LadderStage,
  BudgetRow,
  MaintenanceLog,
  Sponsor,
  Photo,
  YearbookOrder,
  Series,
  Standing,
  Setup,
  StintPlan,
  Update,
  Rule,
  TowerEvent,
  Registration,
  ImpactSummary,
  Discipline,
  PlanInfo,
} from "@shared/types";

/** A venue pin on the national canvas (lightweight; map-render shape). */
export interface VenuePin {
  id: string;
  name: string;
  category: "oval" | "motocross" | "road" | "drag" | "karting" | "circuit";
  surface?: string | null;
  city?: string | null;
  state?: string | null;
  lat: number;
  lng: number;
  website?: string | null;
  status: string;
}

/** Error thrown by the API client; carries the machine-readable code + status. */
export class ApiErr extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiErr";
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = (data.error as string) || res.statusText;
    const message = (data.message as string) || code;
    throw new ApiErr(code, message, res.status);
  }
  return data as T;
}

export const api = {
  // analytics — fire-and-forget; never blocks or throws.
  trackEvent: (event: string, label?: string) => {
    try {
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, label }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* ignore */ }
  },
  adminFunnel: () =>
    req<{ since: string; totals: { event: string; n: number }[]; top: { event: string; label: string; n: number }[] }>(
      "/admin/funnel",
    ),

  // admin — cost dashboard + discovery/crew controls
  adminCost: () =>
    req<{
      budgets: { api: string; used: number; limit: number; configured: boolean }[];
      pending: { events: number; crews: number };
      engines: Record<string, boolean>;
    }>("/admin/cost"),
  adminSweep: () =>
    req<{ ok: boolean; done: boolean; sector?: string; state?: string; events?: number; crews?: number; configured: boolean }>(
      "/admin/sweep",
      { method: "POST" },
    ),
  adminDiscover: (sector: string, state: string) =>
    req<{ ok: boolean; ran: boolean; events: number; crews: number; configured: boolean }>(
      `/admin/discover/${sector}/${state}`,
      { method: "POST" },
    ),
  adminSmoke: () =>
    req<{ results: { engine: string; status: "ok" | "fail" | "skipped"; detail: string; ms?: number }[] }>(
      "/admin/smoke",
      { method: "POST" },
    ),
  adminCrews: (sector: string, state: string) =>
    req<{ crews: any[] }>(`/admin/crews/${sector}/${state}`),
  adminReviewCrew: (id: string, approve: boolean) =>
    req<{ ok: true }>(`/admin/crews/${id}/review`, { method: "POST", body: JSON.stringify({ approve }) }),

  // auth
  me: () => req<{ user: PublicUser | null }>("/auth/me"),
  login: (email: string, password: string) =>
    req<{ user: PublicUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (body: Record<string, unknown>) =>
    req<{ user: PublicUser }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  logout: () => req<{ ok: true }>("/auth/logout", { method: "POST" }),
  forgotPassword: (email: string) =>
    req<{ ok: true }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    req<{ ok: true; user: PublicUser }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  verifyEmail: (token: string) =>
    req<{ ok: true; user: PublicUser }>("/auth/verify", { method: "POST", body: JSON.stringify({ token }) }),
  resendVerification: () => req<{ ok: true }>("/auth/resend-verification", { method: "POST" }),

  // translation (Workers AI) — batch translate dynamic content strings.
  translate: (texts: string[], target = "es") =>
    req<{ translations: string[] }>("/translate", {
      method: "POST",
      body: JSON.stringify({ texts, target }),
    }),

  // grid
  events: (params: Record<string, string> = {}) =>
    req<{ events: EventItem[] }>(`/events?${new URLSearchParams(params)}`),
  event: (slug: string) =>
    req<{ event: EventItem & { track_slug?: string; track_lat?: number; track_lng?: number } }>(
      `/events/${slug}`,
    ),
  toggleSave: (id: string) => req<{ saved: boolean }>(`/events/${id}/save`, { method: "POST" }),
  savedEvents: () => req<{ events: EventItem[] }>("/events/saved/mine"),
  registerForEvent: (id: string, body: Record<string, unknown>) =>
    req<{ ok: true }>(`/events/${id}/register`, { method: "POST", body: JSON.stringify(body) }),
  myRegistrations: () => req<{ registrations: Registration[] }>("/events/registrations/mine"),
  eventResults: (slug: string, refresh = false) =>
    req<{ linked: boolean; sessions: any[] }>(`/events/${slug}/results${refresh ? "?refresh=1" : ""}`),
  mapPins: () =>
    req<{
      events: { slug: string; title: string; discipline?: string; starts_at: number; lat: number; lng: number; track_name?: string; live: number }[];
      endangered: { slug: string; name: string; state?: string; lat: number; lng: number; threat_type?: string }[];
      legislation: { state: string; state_name: string; enacted: number; active: number; total: number }[];
    }>("/map/pins"),
  mapStats: () =>
    req<{
      eventsUpcoming: number; tracksTotal: number; statesCovered: number; disciplines: number;
      endangered: number; legStates: number; lawsEnacted: number; billsActive: number;
      supporters: number; resultsRecorded: number; liveNow: number;
    }>("/map/stats"),

  // tracks
  tracks: (params: Record<string, string> = {}) =>
    req<{ tracks: Track[] }>(`/tracks?${new URLSearchParams(params)}`),
  track: (slug: string) =>
    req<{ track: Track; events: EventItem[]; threats: Threat[] }>(`/tracks/${slug}`),

  // venues — the national canvas
  venues: (params: Record<string, string> = {}) =>
    req<{ venues: VenuePin[] }>(`/venues?${new URLSearchParams(params)}`),
  venueStats: () =>
    req<{ total: number; states: number; byCategory: { category: string; n: number }[] }>(
      "/venues/stats",
    ),
  // newcomer on-ramp
  startSector: (sector: string, state?: string) =>
    req<{
      sector: string;
      state: string | null;
      venues: { id: string; name: string; category: string; city: string | null; state: string | null; lat: number; lng: number; website: string | null; starter_note: string | null }[];
      events: { slug: string; title: string; discipline: string | null; level: string | null; starts_at: number; needs_review?: number; source?: string; track_name: string | null; track_city: string | null; track_state: string | null }[];
      crews: { id: string; name: string; kind: string; blurb: string | null; city: string | null; state: string | null; website: string | null; email: string | null; phone: string | null; facebook: string | null; meets: string | null; beginner_friendly: number; needs_review: number; verified: number; citations: { title?: string; url: string }[] }[];
      discovery: { configured: boolean; pending: boolean };
    }>(`/start/${sector}${state ? `?state=${state}` : ""}`),
  venue: (id: string) =>
    req<{ venue: any; events: { slug: string; title: string; discipline?: string; starts_at: number; live: number }[] }>(
      `/venues/${id}`,
    ),

  // riders / pit board
  riders: () => req<{ riders: Rider[] }>("/riders"),
  createRider: (body: Record<string, unknown>) =>
    req<{ rider: Rider }>("/riders", { method: "POST", body: JSON.stringify(body) }),
  deleteRider: (id: string) => req<{ ok: true }>(`/riders/${id}`, { method: "DELETE" }),
  updateRider: (id: string, body: Record<string, unknown>) =>
    req<{ rider: Rider }>(`/riders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  publishRider: (id: string, publish: boolean) =>
    req<{ ok: true; published: boolean; slug: string | null }>(`/riders/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ publish }),
    }),

  // public racer directory
  racers: (params: Record<string, string> = {}) =>
    req<{ racers: { slug: string; name: string; number: string | null; discipline: string | null; race_class: string | null; skill_level: string | null; hometown: string | null; wins: number; result_count: number }[] }>(
      `/racers?${new URLSearchParams(params)}`,
    ),
  racerStats: () =>
    req<{ total: number; byDiscipline: { discipline: string; n: number }[] }>("/racers/stats"),
  racer: (slug: string) =>
    req<{
      racer: { slug: string; name: string; number: string | null; discipline: string | null; race_class: string | null; skill_level: string | null; wins: number; bio: string | null; hometown: string | null };
      results: any[];
      photos: { id: string; caption: string | null }[];
      stats: { events: number; results: number; podiums: number; wins: number };
    }>(`/racers/${slug}`),
  riderResults: (id: string) =>
    req<{ results: any[] }>(`/riders/${id}/results`),
  budgetSummary: () => req<{ summary: BudgetRow[] }>("/riders/budget/summary"),
  addBudget: (body: Record<string, unknown>) =>
    req<{ ok: true }>("/riders/budget", { method: "POST", body: JSON.stringify(body) }),

  // advocacy
  legislation: (params: Record<string, string> = {}) =>
    req<{ legislation: Legislation[] }>(`/advocacy/legislation?${new URLSearchParams(params)}`),
  endangered: () =>
    req<{ tracks: (Track & { threat_type?: string; description?: string })[] }>(
      "/advocacy/endangered",
    ),
  legislators: (zip: string) =>
    req<{ configured: boolean; state: string | null; finderUrl?: string; officials: { name: string; office: string; party?: string; emails?: string[]; phones?: string[]; url?: string }[] }>(
      `/advocacy/legislators?zip=${encodeURIComponent(zip)}`,
    ),
  support: (kind: string, target_type: string, target_id: string) =>
    req<{ ok: true; supporters: number }>("/advocacy/support", {
      method: "POST",
      body: JSON.stringify({ kind, target_type, target_id }),
    }),

  // ladder (Road to the Ranch)
  ladders: () => req<{ ladders: (Series & { stages: LadderStage[] })[] }>("/ladder"),
  riderLadder: (riderId: string) =>
    req<{ rider: Rider; ladder: Series | null; stages: LadderStage[] }>(`/ladder/rider/${riderId}`),
  recordLadder: (body: Record<string, unknown>) =>
    req<{ ok: true }>("/ladder/progress", { method: "POST", body: JSON.stringify(body) }),
  clearLadder: (id: string) => req<{ ok: true }>(`/ladder/progress/${id}`, { method: "DELETE" }),

  // BMX NAG points (best-8 calculator)
  nagStanding: (riderId: string) =>
    req<{
      scores: { id: string; label: string | null; points: number; counting: boolean }[];
      total: number;
      counting_count: number;
      needed: number;
      races_until_full: number;
      improve_threshold: number | null;
    }>(`/ladder/nag/${riderId}`),
  addNagScore: (riderId: string, body: Record<string, unknown>) =>
    req<{ ok: true; id: string }>(`/ladder/nag/${riderId}`, { method: "POST", body: JSON.stringify(body) }),
  deleteNagScore: (id: string) => req<{ ok: true }>(`/ladder/nag/score/${id}`, { method: "DELETE" }),

  // Drag track-points projection (cumulative; shares the points log + nag score routes)
  pointsStanding: (riderId: string) =>
    req<{
      scores: { id: string; label: string | null; points: number }[];
      total: number;
      races: number;
      avg: number;
      target: number | null;
      remaining: number | null;
      races_to_target: number | null;
      on_track: boolean | null;
    }>(`/ladder/points/${riderId}`),
  setPointsTarget: (riderId: string, target: number | null) =>
    req<{ ok: true; target: number | null }>(`/ladder/points/${riderId}/target`, {
      method: "POST",
      body: JSON.stringify({ target }),
    }),

  // photos
  photos: (params: Record<string, string> = {}) =>
    req<{ photos: Photo[] }>(`/photos?${new URLSearchParams(params)}`),
  uploadPhoto: (fd: FormData) =>
    fetch("/api/photos", { method: "POST", credentials: "include", body: fd }).then(async (r) => {
      const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) throw new ApiErr((d.error as string) || "error", (d.message as string) || "Upload failed", r.status);
      return d as { photo: Photo };
    }),
  deletePhoto: (id: string) => req<{ ok: true }>(`/photos/${id}`, { method: "DELETE" }),

  // yearbook
  yearbooks: () => req<{ orders: YearbookOrder[] }>("/yearbook"),
  createYearbook: (body: Record<string, unknown>) =>
    req<{ order: YearbookOrder }>("/yearbook", { method: "POST", body: JSON.stringify(body) }),
  yearbookCheckout: (id: string) =>
    req<{ url: string }>(`/yearbook/${id}/checkout`, { method: "POST" }),

  // maintenance
  maintenance: (params: Record<string, string> = {}) =>
    req<{ logs: MaintenanceLog[] }>(`/maintenance?${new URLSearchParams(params)}`),
  addMaintenance: (body: Record<string, unknown>) =>
    req<{ ok: true; id: string }>("/maintenance", { method: "POST", body: JSON.stringify(body) }),
  deleteMaintenance: (id: string) => req<{ ok: true }>(`/maintenance/${id}`, { method: "DELETE" }),

  // comms
  myUpdates: () => req<{ updates: Update[] }>("/comms/mine"),
  announce: (eventId: string, body: Record<string, unknown>) =>
    req<{ ok: true; recipients: number }>(`/comms/events/${eventId}/announce`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // series / standings
  seriesList: () => req<{ series: Series[] }>("/series"),
  mySeries: () => req<{ series: Series[] }>("/series/mine/list"),
  createSeries: (body: Record<string, unknown>) =>
    req<{ series: Series }>("/series", { method: "POST", body: JSON.stringify(body) }),
  addRound: (seriesId: string, eventId: string) =>
    req<{ ok: true }>(`/series/${seriesId}/rounds`, {
      method: "POST",
      body: JSON.stringify({ event_id: eventId }),
    }),
  postResults: (eventId: string, results: unknown[]) =>
    req<{ ok: true; count: number }>(`/series/results/${eventId}`, {
      method: "POST",
      body: JSON.stringify({ results }),
    }),
  standings: (slug: string) =>
    req<{ series: Series; standings: Standing[] }>(`/series/${slug}/standings`),

  // garage
  setups: () => req<{ setups: Setup[] }>("/garage/setups"),
  createSetup: (body: Record<string, unknown>) =>
    req<{ ok: true; id: string }>("/garage/setups", { method: "POST", body: JSON.stringify(body) }),
  deleteSetup: (id: string) => req<{ ok: true }>(`/garage/setups/${id}`, { method: "DELETE" }),
  stints: () => req<{ plans: StintPlan[] }>("/garage/stints"),
  createStint: (body: Record<string, unknown>) =>
    req<{ ok: true; id: string }>("/garage/stints", { method: "POST", body: JSON.stringify(body) }),
  deleteStint: (id: string) => req<{ ok: true }>(`/garage/stints/${id}`, { method: "DELETE" }),

  // tower (operator)
  towerEvents: () => req<{ events: TowerEvent[] }>("/tower/events"),
  createTowerEvent: (body: Record<string, unknown>) =>
    req<{ event: TowerEvent }>("/tower/events", { method: "POST", body: JSON.stringify(body) }),
  towerRegistrations: (id: string) =>
    req<{ registrations: Registration[]; impact: ImpactSummary }>(
      `/tower/events/${id}/registrations`,
    ),

  // sponsors
  sponsors: () => req<{ sponsors: Sponsor[] }>("/sponsors"),
  addSponsor: (body: Record<string, unknown>) =>
    req<{ ok: true; id: string }>("/sponsors", { method: "POST", body: JSON.stringify(body) }),
  updateSponsor: (id: string, body: Record<string, unknown>) =>
    req<{ ok: true }>(`/sponsors/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSponsor: (id: string) => req<{ ok: true }>(`/sponsors/${id}`, { method: "DELETE" }),

  // rules
  rules: (params: Record<string, string> = {}) =>
    req<{ rules: Rule[] }>(`/rules?${new URLSearchParams(params)}`),

  // demo
  startDemo: (body: Record<string, unknown>) =>
    req<{ user: PublicUser }>("/demo", { method: "POST", body: JSON.stringify(body) }),

  // AI marketing studio
  studioGenerate: (body: Record<string, unknown>) =>
    req<{ body: string }>("/studio/generate", { method: "POST", body: JSON.stringify(body) }),
  studioAssets: () =>
    req<{ assets: { id: string; kind: string; title: string | null; body: string; created_at: number }[] }>(
      "/studio/assets",
    ),
  studioSave: (body: Record<string, unknown>) =>
    req<{ ok: true; id: string }>("/studio/assets", { method: "POST", body: JSON.stringify(body) }),
  studioDelete: (id: string) => req<{ ok: true }>(`/studio/assets/${id}`, { method: "DELETE" }),

  // team microsite
  myTeamPage: () => req<{ page: any | null }>("/teampages/mine"),
  saveTeamPage: (body: Record<string, unknown>) =>
    req<{ page: any }>("/teampages/mine", { method: "POST", body: JSON.stringify(body) }),
  aiBio: (name: string, facts: string) =>
    req<{ tagline: string; bio: string }>("/teampages/mine/ai-bio", {
      method: "POST",
      body: JSON.stringify({ name, facts }),
    }),
  publicTeamPage: (slug: string) =>
    req<{
      page: any;
      riders?: any[];
      events?: any[];
      photos?: { id: string; caption: string | null }[];
      sponsors?: { name: string; tier: string | null }[];
      ladder?: { rider: string; stage: string; result_pos: number | null; advanced: number }[];
      stats?: { riders: number; races: number; advancements: number };
    }>(`/teampages/public/${slug}`),
  setPhotoPublic: (id: string, isPublic: boolean) =>
    req<{ ok: true }>(`/photos/${id}/public`, { method: "PATCH", body: JSON.stringify({ public: isPublic }) }),

  // notifications
  notifications: () => req<{ notifications: any[]; unread: number }>("/notifications"),
  markRead: (id?: string) =>
    req<{ ok: true }>("/notifications/read", { method: "POST", body: JSON.stringify(id ? { id } : {}) }),
  notifyPrefs: () => req<{ prefs: any; vapidConfigured: boolean }>("/notifications/prefs"),
  saveNotifyPrefs: (prefs: Record<string, boolean>) =>
    req<{ ok: true }>("/notifications/prefs", { method: "POST", body: JSON.stringify(prefs) }),
  vapidKey: () => req<{ key: string | null }>("/notifications/vapid"),
  pushSubscribe: (subscription: unknown) =>
    req<{ ok: true }>("/notifications/subscribe", { method: "POST", body: JSON.stringify({ subscription }) }),
  pushUnsubscribe: (endpoint: string) =>
    req<{ ok: true }>("/notifications/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }),

  // sectors
  setSectors: (sectors: string[]) =>
    req<{ ok: true; sectors: string[] }>("/onboarding/sectors", {
      method: "POST",
      body: JSON.stringify({ sectors }),
    }),

  // onboarding + AI import
  onboardingStatus: () =>
    req<{ steps: Record<string, boolean>; done: number; total: number; role: string; plan: string }>(
      "/onboarding/status",
    ),
  importParse: (text: string) =>
    req<{ riders: any[]; events: any[]; note?: string }>("/onboarding/import/parse", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  importCommit: (riders: any[], events: any[]) =>
    req<{ ok: true; ridersAdded: number; eventsAdded: number }>("/onboarding/import/commit", {
      method: "POST",
      body: JSON.stringify({ riders, events }),
    }),

  // meta + billing
  capabilities: () =>
    req<{
      plan: string;
      role: string;
      can: Record<string, boolean>;
      riderLimit: number | null;
    }>("/meta/capabilities"),
  config: () => req<{ mapbox_token: string | null; app_url: string }>("/meta/config"),
  reference: () =>
    req<{ disciplines: Discipline[]; bodies: { slug: string; label: string }[]; regions: string[] }>(
      "/meta/reference",
    ),
  stats: () => req<{ stats: Record<string, number> }>("/meta/stats"),
  plans: () => req<{ plans: PlanInfo[] }>("/billing/plans"),
  checkout: (plan: string) =>
    req<{ url: string }>("/billing/checkout", { method: "POST", body: JSON.stringify({ plan }) }),
};
