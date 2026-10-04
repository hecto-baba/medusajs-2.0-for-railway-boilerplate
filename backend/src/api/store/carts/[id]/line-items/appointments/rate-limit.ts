import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 30

// Per-process, in-memory sliding window per client IP (same approach as the
// enquiry form's limiter). Reserving a slot holds a place for other buyers, so
// without a limit one client could open carts and hold every slot indefinitely.
// This is NOT shared across instances or restarts - put a gateway/Redis limit in
// front for real abuse protection.
const hits = new Map<string, number[]>()

export function appointmentReserveRateLimit(
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
    res.status(429).json({
      type: "too_many_requests",
      message: "Too many booking attempts. Please try again in a few minutes.",
    })
    return
  }

  recent.push(now)
  hits.set(ip, recent)

  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key)
    }
  }

  next()
}
