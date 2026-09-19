// A small in-memory limit so one visitor cannot adopt hundreds of benches in a row.
// It resets when the server restarts and is per server instance, so treat it as a speed bump, not a wall.
// A real launch would add payment and email confirmation, which do this job properly.

const hits = new Map<string, number[]>();

export function tooManyRequests(key: string, limit = 10, windowMs = 60 * 60 * 1000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return false;
}
