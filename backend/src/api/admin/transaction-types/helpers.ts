import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ActivityActor } from "../../../workflows/steps/transaction-type/types"

/** Fields the list and detail routes return by default. */
export const TRANSACTION_TYPE_FIELDS = [
  "id",
  "name",
  "code",
  "description",
  "icon_url",
  "status",
  "rank",
  "created_at",
  "updated_at",
  // Returned so the admin can tell a restorable row from a live one when
  // listing with `with_deleted`. It is null for every row otherwise.
  "deleted_at",
]

export const TRANSACTION_TYPE_ACTIVITY_FIELDS = [
  "id",
  "action",
  "actor_id",
  "actor_email",
  "previous_status",
  "new_status",
  "changes",
  "created_at",
]

/**
 * Resolves who is making the request, for the audit trail.
 *
 * actor_id comes off the verified token rather than the body, so the trail
 * cannot be forged by a caller claiming to be someone else. The email is
 * looked up here and stored denormalized on the activity row, because the
 * User module sits behind a module boundary the activity model cannot cross
 * with a foreign key - and an audit row has to stay readable after the user
 * it names is gone.
 *
 * A failure to resolve the email is deliberately not fatal: losing the whole
 * write because a display field could not be fetched would be a worse outcome
 * than an activity row that records only the id.
 */
export const resolveActor = async (
  req: AuthenticatedMedusaRequest
): Promise<ActivityActor> => {
  const actorId = req.auth_context?.actor_id

  if (!actorId) {
    return { actor_id: null, actor_email: null }
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const {
      data: [user],
    } = await query.graph({
      entity: "user",
      fields: ["id", "email"],
      filters: { id: [actorId] },
    })

    return { actor_id: actorId, actor_email: user?.email ?? null }
  } catch {
    return { actor_id: actorId, actor_email: null }
  }
}
