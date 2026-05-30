export function fmtDate(epoch: number | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!epoch) return "TBD";
  return new Date(epoch * 1000).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

export function fmtDateShort(epoch: number | null | undefined) {
  if (!epoch) return { mon: "TBD", day: "" };
  const d = new Date(epoch * 1000);
  return {
    mon: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
}

export function fmtMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function daysUntil(epoch: number | null | undefined): number | null {
  if (!epoch) return null;
  return Math.ceil((epoch * 1000 - Date.now()) / 86_400_000);
}

export function titleCase(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/(^|[-\s])\w/g, (m) => m.toUpperCase()).replace(/-/g, " ");
}

/** Parse a JSON string with a typed fallback; never throws. */
export function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
