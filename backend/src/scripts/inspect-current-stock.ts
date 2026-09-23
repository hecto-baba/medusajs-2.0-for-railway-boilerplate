import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function inspectCurrentStock({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: levels } = await query.graph({
    entity: "inventory_level",
    fields: [
      "id",
      "inventory_item_id",
      "location_id",
      "stocked_quantity",
      "reserved_quantity",
      "available_quantity",
      "stock_locations.name",
      "inventory_item.id",
      "inventory_item.title",
      "inventory_item.sku",
      "inventory_item.stocked_quantity",
    ],
  })

  console.log("=== ALL INVENTORY LEVELS IN DATABASE ===")
  for (const l of levels) {
    console.log(`Level ${l.id} at [${l.stock_locations?.name || l.location_id}]: stocked=${l.stocked_quantity}, reserved=${l.reserved_quantity}, available=${l.available_quantity}`)
    console.log(`  -> Item: ${l.inventory_item?.title} (${l.inventory_item?.id}), item.stocked_quantity=${l.inventory_item?.stocked_quantity}`)
  }

  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: [
      "id",
      "title",
      "sku",
      "stocked_quantity",
      "reserved_quantity",
      "location_levels.*",
      "variants.*",
    ],
  })

  console.log("\n=== ALL INVENTORY ITEMS ===")
  for (const it of items) {
    console.log(`Item ${it.id} (${it.title}): raw_stocked=${it.stocked_quantity}, levels_count=${it.location_levels?.length}`)
    for (const lvl of it.location_levels ?? []) {
      console.log(`    Level: location=${lvl.location_id}, stocked=${lvl.stocked_quantity}`)
    }
  }
}
