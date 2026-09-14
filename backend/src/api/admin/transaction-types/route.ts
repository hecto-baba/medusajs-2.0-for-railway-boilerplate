import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"
import {
  TRANSACTION_TYPE_STATUSES,
  TransactionTypeStatus,
} from "../../../modules/transaction-type/models/transaction-type"
import { createTransactionTypeWorkflow } from "../../../workflows/transaction-type/create-transaction-type"
import { resolveActor } from "./helpers"

/**
 * createFindParams gives fields, offset, limit, order and with_deleted, but
 * not q - an unrecognised query param is stripped by the validator, so free
 * text search has to be declared explicitly or it would silently return
 * everything. The status filter is declared for the same reason.
 */
export const GetTransactionTypesSchema = createFindParams({
  limit: 50,
  offset: 0,
}).merge(
  z.object({
    q: z.string().optional(),
    status: z
      .union([
        z.enum(TRANSACTION_TYPE_STATUSES as [string, ...string[]]),
        z.array(z.enum(TRANSACTION_TYPE_STATUSES as [string, ...string[]])),
      ])
      .optional(),
  })
)

export const PostTransactionTypeSchema = z.object({
  name: z.string().min(1, "A name is required"),
  code: z
    .string()
    .min(1, "A code is required")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "A code may only contain letters, numbers, underscores and hyphens"
    )
    // Stored uppercase so codes are unambiguous to match on, both here and
    // in the CSV import.
    .transform((code) => code.toUpperCase()),
  description: z.string().optional(),
  // Constrained to an http(s) URL rather than left as free text. It is only
  // rendered in an <img src> today, where a javascript: value is inert, but
  // storing one would become live XSS the moment anything renders it as a
  // link - so it is rejected at the edge instead.
  icon_url: z
    .string()
    .url("An icon must be a valid URL")
    .refine((url) => /^https?:\/\//i.test(url), {
      message: "An icon URL must start with http:// or https://",
    })
    .optional(),
  // Only draft and active are reachable at creation; the other two states
  // exist only as the result of a transition. Declared against the enum
  // rather than as string literals so this stays a single source of truth -
  // and so the inferred type is the enum the workflow expects, since a bare
  // string literal is not assignable to a string enum member.
  status: z
    .nativeEnum(TransactionTypeStatus)
    .refine(
      (status) =>
        status === TransactionTypeStatus.DRAFT ||
        status === TransactionTypeStatus.ACTIVE,
      {
        message: `A transaction type can only be created as "${TransactionTypeStatus.DRAFT}" or "${TransactionTypeStatus.ACTIVE}"`,
      }
    )
    .optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Filters come from req.filterableFields, not req.queryConfig. The
  // validator splits the parsed query in two: fields and pagination land on
  // queryConfig, and everything else - q, status - on filterableFields.
  // Spreading queryConfig alone silently returns unfiltered results.
  // withDeleted is carried on queryConfig, not filterableFields: the query
  // validator deliberately destructures `with_deleted` out of the filters and
  // hands it to the remote query config instead, so it has to be forwarded
  // explicitly or the soft deleted rows stay hidden however the client asks.
  const { data: transaction_types, metadata } = await query.graph({
    entity: "transaction_type",
    fields: req.queryConfig.fields,
    filters: req.filterableFields,
    pagination: req.queryConfig.pagination,
    withDeleted: req.queryConfig.withDeleted,
  } as Parameters<typeof query.graph>[0])

  res.json({
    transaction_types,
    count: metadata?.count ?? transaction_types.length,
    limit: metadata?.take ?? transaction_types.length,
    offset: metadata?.skip ?? 0,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostTransactionTypeSchema>>,
  res: MedusaResponse
) => {
  const actor = await resolveActor(req)

  // Destructured rather than spread: the code field carries a transform, and
  // z.infer widens a transformed required field to optional, which does not
  // satisfy the workflow's input type. Naming the fields keeps the contract
  // explicit and the validator is what guarantees they are present.
  const { name, code, description, icon_url, status } = req.validatedBody

  const { result } = await createTransactionTypeWorkflow(req.scope).run({
    input: { name, code, description, icon_url, status, ...actor },
  })

  res.status(201).json({ transaction_type: result })
}
