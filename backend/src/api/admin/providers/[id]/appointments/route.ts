import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listBookings } from "../../../../../modules/appointment-booking/lib/resource-ops"
import { getService, loadResource } from "../../helpers"

/**
 * One resource's confirmed bookings (one row per slot, with attendees),
 * paginated. `?status=upcoming|past|all` (default upcoming).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const resource = await loadResource(req, req.params.id)
  const { limit = "20", offset = "0", status = "upcoming" } = req.query as Record<string, string>

  const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const skip = Math.max(0, parseInt(offset, 10) || 0)

  const { appointments, count } = await listBookings(req.scope, getService(req), {
    providerIds: [resource.id],
    status: status === "past" || status === "all" ? status : "upcoming",
    limit: take,
    offset: skip,
  })

  res.json({ appointments, count, limit: take, offset: skip })
}
