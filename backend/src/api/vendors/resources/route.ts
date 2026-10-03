import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  computeReadiness,
  getAppointmentService,
  ownedResourcesFilter,
  resolveVendorId,
} from "./helpers"
import { isUniqueViolation } from "../../../modules/appointment-booking/lib/db-errors"
import { PostResourceSchema } from "./schemas"

const MAX_RESOURCES_PER_VENDOR = 200


/** The vendor's resources, each with whether it is ready to take bookings. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service = getAppointmentService(req)

  const resources = await service.listProviders(await ownedResourcesFilter(req), {
    take: null,
    order: { created_at: "ASC" },
  })

  const readiness = await computeReadiness(service, resources)

  res.json({
    resources: resources.map((r) => ({ ...r, readiness: readiness.get(r.id) })),
    count: resources.length,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostResourceSchema>>,
  res: MedusaResponse
) => {
  const service = getAppointmentService(req)
  const vendorId = await resolveVendorId(req)

  const [, existingCount] = await service.listAndCountProviders(
    { vendor_id: vendorId },
    { take: 1 }
  )
  if (existingCount >= MAX_RESOURCES_PER_VENDOR) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `You can have at most ${MAX_RESOURCES_PER_VENDOR} resources.`
    )
  }

  // Drop undefined keys so column defaults apply instead of being overwritten.
  const body = Object.fromEntries(
    Object.entries(req.validatedBody).filter(([, v]) => v !== undefined)
  ) as z.infer<typeof PostResourceSchema>

  try {
    const resource = await service.createProviders({
      ...body,
      vendor_id: vendorId,
      vendor_admin_id: req.auth_context.actor_id,
    })

    res.status(201).json({ resource })
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "You already have a resource with this name."
      )
    }
    throw err
  }
}
