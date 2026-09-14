import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function fixInventory({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT)
  const variants = await productService.listProductVariants({}, { select: ["id", "title", "manage_inventory", "allow_backorder"] })
  console.log("Total variants found:", variants.length)

  for (const v of variants) {
    await productService.updateProductVariants(v.id, {
      manage_inventory: false,
      allow_backorder: true,
    })
    console.log(`Updated variant ${v.id} (${v.title}) to manage_inventory: false, allow_backorder: true`)
  }

  console.log("All product variants have been updated to in-stock!")
}
