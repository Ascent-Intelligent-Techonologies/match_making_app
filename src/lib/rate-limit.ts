import "server-only";
import { headers } from "next/headers";

/**
 * A fixed allowance of calls per key per window, counted in this process.
 *
 * The site runs as a single App Service instance, so an in-memory count is
 * accurate; it resets when the app restarts, and would count per instance if
 * the app were ever scaled out. That is acceptable for what it protects (the
 * public self-onboarding form): it blunts a script hammering the form, and the
 * daily cap and the admin approval step are the backstops behind it.
 */
const calls = new Map<string, number[]>();
const SWEEP_AT = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** True when this call is over the limit; otherwise records it and returns false. */
export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (calls.get(key) ?? []).filter((at) => now - at < windowMs);

  if (recent.length >= max) {
    calls.set(key, recent);
    return true;
  }

  recent.push(now);
  calls.set(key, recent);

  // Keys come from visitors' addresses, so the map must not grow without end.
  if (calls.size > SWEEP_AT) {
    for (const [k, times] of calls) {
      if (times.every((at) => now - at >= DAY_MS)) calls.delete(k);
    }
  }
  return false;
}

/**
 * The visitor's address, for rate limiting.
 *
 * App Service's front end appends the connecting address to X-Forwarded-For
 * (as "ip:port" for IPv4). Anything the visitor sent comes before it, so only
 * the LAST entry can be trusted; the first is whatever they chose to claim.
 */
export async function visitorAddress(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  const last = forwarded.split(",").at(-1)?.trim() ?? "";
  // "1.2.3.4:5678" has one colon; an IPv6 address has several and no port here.
  const address = (last.match(/:/g)?.length ?? 0) === 1 ? last.split(":")[0] : last;
  return address || "unknown";
}
