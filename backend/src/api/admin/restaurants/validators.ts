import { z } from "@medusajs/framework/zod"

export const createRestaurantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  handle: z.string().optional().transform((v) => (!v || !v.trim() ? undefined : v)),
  phone: z.string().optional().transform((v) => (!v || !v.trim() ? "N/A" : v)),
  email: z.string().optional().transform((v) => (!v || !v.trim() ? "info@restaurant.com" : v)),
  address: z.string().optional().transform((v) => (!v || !v.trim() ? "N/A" : v)),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  is_open: z.boolean().optional().default(false),
})

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>
