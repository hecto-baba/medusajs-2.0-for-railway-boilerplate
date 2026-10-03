import { z } from "@medusajs/framework/zod"

/**
 * Shared between the admin and vendor eoi-config routes so the two panels
 * cannot drift on request shape. Imported by both
 * admin/products/[id]/variants/[variant_id]/eoi-config/route.ts and
 * vendors/products/[id]/variants/[variant_id]/eoi-config/route.ts.
 *
 * Variant-scoped (see docs/plan/EOI_VARIANT_LEVEL_CONFIG_PLAN.md) - the Zod
 * shape itself is unchanged from the product-scoped version, only which id
 * it's keyed by in the URL changes.
 */
export const PostEoiConfigBodySchema = z
  .object({
    value_type: z.enum(["fixed", "percentage"]).optional(),
    value_amount: z.number().finite().min(0).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine(
    (body) =>
      !(body.value_type === "percentage" && body.value_amount !== undefined) ||
      body.value_amount <= 100,
    { message: "A percentage value_amount cannot exceed 100.", path: ["value_amount"] }
  )

export type PostEoiConfigBody = z.infer<typeof PostEoiConfigBodySchema>
