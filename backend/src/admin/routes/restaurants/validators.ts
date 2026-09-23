import * as z from "zod"

export const adminCreateRestaurantValidator = z.object({
  name: z.string().min(1, "Name is required"),
  handle: z.string().optional(),
  description: z.string().optional(),
  image_url: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  is_open: z.boolean().optional(),
})

export type AdminCreateRestaurantType = z.infer<typeof adminCreateRestaurantValidator>

export const adminEditRestaurantValidator = z.object({
  name: z.string().min(1, "Name is required"),
  handle: z.string().optional(),
  description: z.string().optional(),
  image_url: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  is_open: z.boolean().optional(),
})

export type AdminEditRestaurantType = z.infer<typeof adminEditRestaurantValidator>
