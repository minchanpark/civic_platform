type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

// ponytail: per-instance fixed windows are enough for the local Fast MVP; use a shared
// store only when traffic is distributed across multiple Cloud Run instances.
export function takeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  for (const [storedKey, value] of windows) {
    if (value.resetAt <= now) windows.delete(storedKey);
  }

  const current = windows.get(key);
  if (!current) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
