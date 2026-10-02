import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5

// Per-process, in-memory sliding window. That is enough to stop a single
// client hammering the public form, but it is NOT shared across instances or
// restarts - put a gateway/Redis limit in front for real abuse protection.
const hits = new Map<string, number[]>()

export function enquiryRateLimit(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const forwarded = req.headers["x-forwarded-for"]
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0])?.trim() ||
    req.ip ||
    "unknown"

  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)

  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent)
    res
      .status(429)
      .json({ type: "too_many_requests", message: "Too many enquiries. Please try again later." })
    return
  }

  recent.push(now)
  hits.set(ip, recent)

  // Opportunistic cleanup so the map can't grow without bound.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key)
    }
  }

  next()
}
