import { AdminCreateProduct } from "@medusajs/medusa/api/admin/products/validators"
import { z } from "@medusajs/framework/zod"
import { MediaType } from "../../../modules/digital-product/types"

export const createDigitalProductsSchema = z.object({
  name: z.string(),
  medias: z.array(
    z.object({
      type: z.nativeEnum(MediaType),
      file_id: z.string(),
      mime_type: z.string(),
    })
  ),
  product: z.preprocess((val: any) => {
    if (val && typeof val === "object" && Array.isArray(val.variants)) {
      val.variants = val.variants.map((v: any) => {
        if (v && typeof v === "object") {
          const { shipping_profile_id, ...rest } = v
          return rest
        }
        return v
      })
    }
    return val
  }, AdminCreateProduct()),
})

export type CreateDigitalProductsSchema = z.infer<typeof createDigitalProductsSchema>
