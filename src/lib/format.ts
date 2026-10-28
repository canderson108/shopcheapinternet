export function formatPrice(cents: number | null | undefined, opts: { free?: string } = {}): string {
  if (cents === null || cents === undefined) return "—";
  if (cents === 0 && opts.free) return opts.free;
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function formatSpeed(mbps: number): string {
  if (mbps >= 1000) {
    const g = mbps / 1000;
    return `${Number.isInteger(g) ? g : g.toFixed(1)} Gbps`;
  }
  return `${mbps} Mbps`;
}

export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return digits;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const TZ = "America/Chicago";

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
}

/** Formats a calendar date (stored as UTC midnight) without timezone shifting. */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", dateStyle: "medium" });
}

export function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function connectionLabel(t: string): string {
  switch (t) {
    case "FIBER":
      return "Fiber";
    case "FIXED_WIRELESS":
      return "5G Home Internet";
    case "CABLE":
      return "Cable";
    case "DSL":
      return "DSL";
    case "SATELLITE":
      return "Satellite";
    default:
      return "Other";
  }
}

export function relativeTime(d: Date | string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
