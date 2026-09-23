import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { json2csv } from "json-2-csv"
import { getVendorInventoryItemIds } from "../helpers"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const itemIds = await getVendorInventoryItemIds(req)

  if (!itemIds.length) {
    res.json({
      csv: "Title,SKU,Description,In Stock,Reserved,Available,Requires Shipping,Country of Origin,HS Code,MID Code,Material,Weight,Length,Height,Width\n",
      count: 0,
    })
    return
  }

  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: [
      "id",
      "sku",
      "title",
      "description",
      "hs_code",
      "mid_code",
      "origin_country",
      "material",
      "weight",
      "length",
      "height",
      "width",
      "requires_shipping",
      "stocked_quantity",
      "reserved_quantity",
      "location_levels.*",
      "location_levels.stock_locations.name",
    ],
    filters: { id: itemIds },
  })

  const rows = items.map((item: any) => {
    const stocked = Number(item.stocked_quantity ?? 0)
    const reserved = Number(item.reserved_quantity ?? 0)
    const available = stocked - reserved

    const locationsSummary = (item.location_levels ?? [])
      .map(
        (lvl: any) =>
          `${lvl.stock_locations?.name || lvl.location_id}: ${lvl.stocked_quantity ?? 0}`
      )
      .join("; ")

    return {
      Title: item.title ?? "",
      SKU: item.sku ?? "",
      Description: item.description ?? "",
      "In Stock": stocked,
      Reserved: reserved,
      Available: available,
      "Stock By Location": locationsSummary,
      "Requires Shipping": item.requires_shipping ? "Yes" : "No",
      "Country of Origin": item.origin_country ?? "",
      "HS Code": item.hs_code ?? "",
      "MID Code": item.mid_code ?? "",
      Material: item.material ?? "",
      Weight: item.weight ?? "",
      Length: item.length ?? "",
      Height: item.height ?? "",
      Width: item.width ?? "",
    }
  })

  const csv = json2csv(rows)

  res.json({
    csv,
    count: rows.length,
  })
}
