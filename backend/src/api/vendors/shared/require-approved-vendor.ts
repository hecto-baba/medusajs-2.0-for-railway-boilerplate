import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
} from "@medusajs/framework/http"
import { onboardingStore } from "../../../lib/onboarding-store"
import { getVendorId } from "./vendor-scope"

/**
 * Server-side "setup is complete" gate for vendor features.
 *
 * The sellers panel only hides the sidebar and redirects in the browser, so an
 * unapproved vendor could still call these routes directly with their bearer
 * token. This middleware closes that: it answers 403 unless the vendor behind
 * the session has onboarding status APPROVED.
 *
 * It must run AFTER authenticate("vendor", ...), because it reads
 * req.auth_context.actor_id.
 *
 * Cost control: resolving the vendor is a graph query and the status is a
 * primary-key read on every request, so a positive answer is cached per actor
 * for a short TTL. Only APPROVED is cached - a vendor that is still being
 * reviewed is re-checked every time, so approval takes effect immediately, and
 * a revoked vendor loses access within the TTL at most.
 */
const APPROVED_TTL_MS = 60_000

type CacheEntry = { vendorId: string; expiresAt: number }
const approvedActors = new Map<string, CacheEntry>()

// Keep the cache from growing without bound on a long-lived process.
const MAX_CACHE_ENTRIES = 5_000

/**
 * The vendor id the gate already resolved for this actor, if still cached.
 * Lets routes behind the gate skip a second vendor lookup per request.
 */
export const getCachedVendorId = (actorId: string | undefined): string | undefined => {
  if (!actorId) return undefined
  const entry = approvedActors.get(actorId)
  return entry && entry.expiresAt > Date.now() ? entry.vendorId : undefined
}

export const requireApprovedVendor = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  try {
    const actorId = req.auth_context?.actor_id

    if (!actorId) {
      // authenticate() did not populate an actor: not a registered vendor admin.
      return res.status(401).json({
        type: "unauthorized",
        message: "Unauthorized",
      })
    }

    const cached = approvedActors.get(actorId)
    if (cached && cached.expiresAt > Date.now()) {
      return next()
    }

    const vendorId = await getVendorId(req)
    const application = await onboardingStore.getAsync(vendorId)

    if (application.status !== "APPROVED") {
      approvedActors.delete(actorId)
      return res.status(403).json({
        type: "not_allowed",
        message:
          "Your store setup must be approved before you can use appointments.",
      })
    }

    if (approvedActors.size >= MAX_CACHE_ENTRIES) {
      approvedActors.clear()
    }
    approvedActors.set(actorId, {
      vendorId,
      expiresAt: Date.now() + APPROVED_TTL_MS,
    })

    return next()
  } catch (error) {
    return next(error)
  }
}
