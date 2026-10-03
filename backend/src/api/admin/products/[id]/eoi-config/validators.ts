import { z } from "@medusajs/framework/zod"

/**
 * Shared between the admin and vendor eoi-config routes so the two panels
 * cannot drift on request shape. Imported by both
 * admin/products/[id]/eoi-config/route.ts and
 * vendors/products/[id]/eoi-config/route.ts.
 */
export const PostEoiConfigBodySchema = z.object({
  value_type: z.enum(["fixed", "percentage"]).optional(),
  value_amount: z.number().optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

export type PostEoiConfigBody = z.infer<typeof PostEoiConfigBodySchema>
