import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { refetchEntities } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { updateTransactionTypeWorkflow } from "../../../../workflows/transaction-type/update-transaction-type"
import { deleteTransactionTypeWorkflow } from "../../../../workflows/transaction-type/delete-transaction-type"
import { resolveActor, TRANSACTION_TYPE_FIELDS } from "../helpers"

export const PostTransactionTypeUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    code: z
      .string()
      .min(1)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "A code may only contain letters, numbers, underscores and hyphens"
      )
      .transform((code) => code.toUpperCase())
      .optional(),
    // Nullable so an admin can clear these, which is different from omitting
    // them: omitted means "leave alone", null means "remove".
    description: z.string().nullable().optional(),
    // See the create schema: constrained to http(s) so a javascript: or
    // data: value can never be stored.
    icon_url: z
      .string()
      .url("An icon must be a valid URL")
      .refine((url) => /^https?:\/\//i.test(url), {
        message: "An icon URL must start with http:// or https://",
      })
      .nullable()
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  })

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  // refetchEntities rather than refetchEntity: only the plural form forwards
  // withDeleted, and without it a soft deleted type 404s here - leaving it
  // visible in the list but impossible to open or restore, and stranding the
  // history that records its own deletion.
  const { data: [transactionType] } = await refetchEntities({
    entity: "transaction_type",
    idOrFilter: { id: req.params.id },
    scope: req.scope,
    fields: req.queryConfig?.fields ?? TRANSACTION_TYPE_FIELDS,
    withDeleted: true,
  })

  if (!transactionType) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Transaction type with id: ${req.params.id} was not found`
    )
  }

  res.json({ transaction_type: transactionType })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    z.infer<typeof PostTransactionTypeUpdateSchema>
  >,
  res: MedusaResponse
) => {
  const actor = await resolveActor(req)

  const { result } = await updateTransactionTypeWorkflow(req.scope).run({
    input: { id: req.params.id, ...req.validatedBody, ...actor },
  })

  res.json({ transaction_type: result })
}

/**
 * Soft deletes. The row leaves the admin's view and its code becomes
 * available again, but the activity rows describing it - including the record
 * of this deletion - survive.
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const actor = await resolveActor(req)

  await deleteTransactionTypeWorkflow(req.scope).run({
    input: { id: req.params.id, ...actor },
  })

  res.json({
    id: req.params.id,
    object: "transaction_type",
    deleted: true,
  })
}
