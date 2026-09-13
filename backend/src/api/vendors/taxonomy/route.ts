import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * The store's product taxonomy - collections, categories, tags, types, sales
 * channels and shipping profiles - for the pickers in the vendor panel.
 *
 * These are deliberately store-wide rather than vendor-scoped. None of them
 * belongs to a vendor: they are the platform's shared shelving ("Shirts",
 * "Pants"), and a product filed under a category only a single vendor can see
 * would be invisible to the storefront's own navigation. Medusa has no vendor
 * link on any of these entities, so there is nothing to scope by even if that
 * were wanted.
 *
 * What this route does *not* do is let a vendor read anything private through
 * them: only id and label are returned, never the products filed under each,
 * so a vendor cannot enumerate another vendor's catalogue by walking a
 * category.
 *
 * Creating taxonomy is not offered. A vendor inventing categories at will
 * would fragment the store's navigation, and the entries here are a platform
 * decision.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const [
    collections,
    categories,
    tags,
    types,
    salesChannels,
    shippingProfiles,
    stores,
    stockLocations,
  ] = await Promise.all([
    query.graph({
      entity: "product_collection",
      fields: ["id", "title"],
      pagination: { order: { title: "ASC" } },
    }),
    query.graph({
      entity: "product_category",
      fields: ["id", "name"],
      pagination: { order: { name: "ASC" } },
    }),
    query.graph({
      entity: "product_tag",
      fields: ["id", "value"],
      pagination: { order: { value: "ASC" } },
    }),
    query.graph({
      entity: "product_type",
      fields: ["id", "value"],
      pagination: { order: { value: "ASC" } },
    }),
    // Disabled channels are filtered out rather than shown greyed: putting a
    // product into one makes it invisible to shoppers with no indication why.
    query.graph({
      entity: "sales_channel",
      fields: ["id", "name"],
      filters: { is_disabled: false },
      pagination: { order: { name: "ASC" } },
    }),
    query.graph({
      entity: "shipping_profile",
      fields: ["id", "name", "type"],
      pagination: { order: { name: "ASC" } },
    }),
    // Currencies come from the store rather than from regions: a price can be
    // set in any supported currency, whether or not a region uses it yet.
    query.graph({
      entity: "store",
      fields: ["supported_currencies.*"],
    }),
    query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
      pagination: { order: { name: "ASC" } },
    }),
  ])

  res.json({
    collections: collections.data,
    categories: categories.data,
    tags: tags.data,
    types: types.data,
    sales_channels: salesChannels.data,
    shipping_profiles: shippingProfiles.data,
    currencies: (stores.data[0]?.supported_currencies ?? []).map(
      (currency: any) => ({
        code: currency.currency_code,
        is_default: Boolean(currency.is_default),
      })
    ),
    stock_locations: stockLocations.data,
  })
}
