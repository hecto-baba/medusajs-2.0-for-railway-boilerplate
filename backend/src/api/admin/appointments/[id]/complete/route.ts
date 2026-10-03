import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { completeAppointment } from "../../../../../modules/appointment-booking/lib/resource-ops"
import { getService } from "../../../providers/helpers"

/** Marks a booked slot completed (`:id` is the slot id). Idempotent. */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = getService(req)
  const [appointment] = await service.listAppointments({ id: req.params.id }, { take: 1 })
  if (!appointment) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Appointment not found.")
  }

  res.json({ appointment: await completeAppointment(service, appointment) })
}
