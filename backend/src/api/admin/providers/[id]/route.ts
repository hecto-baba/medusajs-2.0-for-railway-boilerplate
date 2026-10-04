import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { isUniqueViolation } from "../../../../modules/appointment-booking/lib/db-errors"
import { computeReadiness } from "../../../vendors/resources/helpers"
import { UpdateResourceSchema } from "../../../vendors/resources/schemas"
import { getService, loadResource, vendorsById } from "../helpers"


export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const service = getService(req)

  const [resource] = await service.listProviders({ id }, { take: 1 })
  if (!resource) {
    res.json({ provider: null })
    return
  }

  const [vendors, readiness, { data: admins }] = await Promise.all([
    vendorsById(req, [resource.vendor_id]),
    computeReadiness(service, [resource]),
    query.graph({
      entity: "provider",
      fields: ["id", "vendor_admin.email", "vendor_admin.first_name", "vendor_admin.last_name"],
      filters: { id },
    }),
  ])

  res.json({
    provider: {
      ...resource,
      vendor: resource.vendor_id ? vendors.get(resource.vendor_id) ?? null : null,
      vendor_admin: (admins as any[])[0]?.vendor_admin ?? null,
      readiness: readiness.get(resource.id),
    },
  })
}

/** Edit profile, booking rules and status on any vendor's resource. */
export const POST = async (
  req: MedusaRequest<z.infer<typeof UpdateResourceSchema>>,
  res: MedusaResponse
) => {
  const resource = await loadResource(req, req.params.id)

  const changes = Object.fromEntries(
    Object.entries(req.validatedBody).filter(([, v]) => v !== undefined)
  )
  if (!Object.keys(changes).length) {
    res.json({ provider: resource })
    return
  }

  try {
    const updated = await getService(req).updateProviders({ id: resource.id, ...changes })
    res.json({ provider: updated })
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "This business already has a resource with that name."
      )
    }
    throw err
  }
}

/** Removes a resource - refused while it still has upcoming bookings or holds. */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const resource = await loadResource(req, req.params.id)
  const service = getService(req)

  const upcoming = await service.listAppointments(
    { provider_id: resource.id, status: ["available", "booked"], end_time: { $gt: new Date() } },
    { select: ["id"], take: null }
  )
  if (upcoming.length) {
    const [live] = await service.listAppointmentAttendees(
      { appointment_id: upcoming.map((a) => a.id), status: ["reserved", "confirmed"] },
      { select: ["id"], take: 1 }
    )
    if (live) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This resource has upcoming bookings. Cancel them first, or mark it inactive."
      )
    }
  }

  await service.softDeleteProviders(resource.id)
  res.json({ id: resource.id, deleted: true })
}
