import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"
import { TRANSACTION_TYPE_MODULE } from "../../../../../modules/transaction-type"
import type TransactionTypeModuleService from "../../../../../modules/transaction-type/service"
import { TRANSACTION_TYPE_ACTIVITY_ACTIONS } from "../../../../../modules/transaction-type/models/transaction-type-activity"
import { TRANSACTION_TYPE_ACTIVITY_FIELDS } from "../../helpers"

export const GetTransactionTypeActivitiesSchema = createFindParams({
  limit: 50,
  offset: 0,
}).merge(
  z.object({
    // The status activity view is this same list filtered to transitions,
    // rather than a second endpoint returning a near-identical shape.
    action: z
      .union([
        z.enum(TRANSACTION_TYPE_ACTIVITY_ACTIONS as [string, ...string[]]),
        z.array(
          z.enum(TRANSACTION_TYPE_ACTIVITY_ACTIONS as [string, ...string[]])
        ),
      ])
      .optional(),
  })
)

/**
 * The audit trail for one transaction type, newest first.
 *
 * Read through the module service rather than query.graph because activities
 * are only ever fetched as the history of a single type, and the service call
 * expresses that directly.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service: TransactionTypeModuleService = req.scope.resolve(
    TRANSACTION_TYPE_MODULE
  )

  const { action } = req.validatedQuery ?? {}
  const { skip, take } = req.queryConfig?.pagination ?? {}

  const filters: Record<string, unknown> = {
    transaction_type_id: req.params.id,
  }

  if (action) {
    filters.action = action
  }

  const [activities, count] =
    await service.listAndCountTransactionTypeActivities(filters, {
      select: TRANSACTION_TYPE_ACTIVITY_FIELDS,
      order: { created_at: "DESC" },
      skip: skip ?? 0,
      take: take ?? 50,
    })

  res.json({
    activities,
    count,
    limit: take ?? 50,
    offset: skip ?? 0,
  })
}
