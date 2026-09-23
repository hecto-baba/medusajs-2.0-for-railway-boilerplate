import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Returns notifications targeted to the calling vendor admin or store.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const limit = Math.min(
    100,
    Math.max(1, Number(req.query.limit) || 20)
  )
  const offset = Math.max(0, Number(req.query.offset) || 0)

  // First fetch the vendor_admin's email to match notifications sent to their email or actor_id
  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "email", "vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const targetRecipients: string[] = [req.auth_context.actor_id]
  if (vendorAdmin?.email) {
    targetRecipients.push(vendorAdmin.email)
  }
  if (vendorAdmin?.vendor?.id) {
    targetRecipients.push(vendorAdmin.vendor.id)
  }

  try {
    const filters: Record<string, any> = {
      $or: [
        { to: targetRecipients },
        { to: "" },
        { channel: "feed" },
      ],
    }

    const { data: notifications, metadata } = await query.graph({
      entity: "notification",
      fields: [
        "id",
        "to",
        "channel",
        "template",
        "data",
        "trigger_type",
        "resource_id",
        "resource_type",
        "created_at",
        "updated_at",
      ],
      filters,
      pagination: {
        skip: offset,
        take: limit,
        order: { created_at: "DESC" },
      },
    })

    res.json({
      notifications: notifications || [],
      count: metadata?.count ?? notifications?.length ?? 0,
      offset: metadata?.skip ?? offset,
      limit: metadata?.take ?? limit,
    })
  } catch (error: any) {
    // If the notification table query fails (e.g. empty or schema differences), return safe empty list
    res.json({
      notifications: [],
      count: 0,
      offset,
      limit,
    })
  }
}
