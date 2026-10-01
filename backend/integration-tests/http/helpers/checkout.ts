import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { call, TestVendor } from "./vendors"

/**
 * Shared fixtures for the checkout tests (Phase 2 and 3): a storefront with a
 * region, a platform tax rate, a payment provider and a publishable key, sellers
 * with their own profile, location, shipping option and product, and carts
 * completed through the real store API.
 */

export const must = async (label: string, request: Promise<any>) => {
  const res = await call(request)
  if (res.status >= 400) {
    throw new Error(`setup "${label}" failed: HTTP ${res.status} ${JSON.stringify(res.data)}`)
  }
  return res
}

export type Storefront = {
  regionId: string
  channelId: string
  storeHeaders: { headers: Record<string, string> }
}

export const setUpStorefront = async (container: any): Promise<Storefront> => {
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as any
  const storeModule = container.resolve(Modules.STORE) as any
  const regionModule = container.resolve(Modules.REGION) as any
  const taxModule = container.resolve(Modules.TAX) as any

  const channel = await salesChannelModule.createSalesChannels({ name: "Default" })
  const [store] = await storeModule.listStores()
  if (store) {
    await storeModule.updateStores(store.id, { default_sales_channel_id: channel.id })
  } else {
    await storeModule.createStores({
      name: "Test store",
      supported_currencies: [{ currency_code: "usd", is_default: true }],
      default_sales_channel_id: channel.id,
    })
  }
  const region = await regionModule.createRegions({
    name: "US",
    currency_code: "usd",
    countries: ["us"],
    payment_providers: ["pp_system_default"],
  })
  const taxRegion = await taxModule.createTaxRegions({ country_code: "us", provider_id: "tp_system" })
  await taxModule.createTaxRates({ tax_region_id: taxRegion.id, name: "Platform tax", code: "PLAT", rate: 10, is_default: true })

  const {
    result: [apiKey],
  } = await createApiKeysWorkflow(container).run({
    input: { api_keys: [{ title: "Storefront", type: "publishable", created_by: "test" }] },
  })
  await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: apiKey.id, add: [channel.id] } })

  return {
    regionId: region.id,
    channelId: channel.id,
    storeHeaders: { headers: { "x-publishable-api-key": apiKey.token } },
  }
}

/** A seller with their own shipping profile, location, shipping option and one plain product. */
export const setUpSeller = async (
  api: any,
  container: any,
  seller: TestVendor,
  label: string,
  price: number
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any

  const profile = (await must(`profile ${label}`, api.post("/vendors/shipping-profiles", { name: `${label} profile`, type: `${label}-default` }, seller.headers))).data.shipping_profile.id
  const type = (await must(`type ${label}`, api.post("/vendors/shipping-option-types", { label: `${label} std`, code: `${label}-std` }, seller.headers))).data.shipping_option_type.id
  const location = (
    await must(`location ${label}`, api.post("/vendors/stock-locations", { name: `${label} wh`, address: { address_1: "1 St", city: "Town", country_code: "us" } }, seller.headers))
  ).data.stock_location.id
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["fulfillment_sets.service_zones.id"],
    filters: { id: location },
  })
  const zone = locations[0].fulfillment_sets[0].service_zones[0].id as string
  const option = (
    await must(
      `option ${label}`,
      api.post(
        "/vendors/shipping-options",
        {
          name: `${label} ship`,
          service_zone_id: zone,
          shipping_profile_id: profile,
          shipping_option_type_id: type,
          prices: [{ currency_code: "usd", amount: 10 }],
        },
        seller.headers
      )
    )
  ).data.shipping_option.id

  const product = await createSellerProduct(api, seller, profile, `${label} product`, price)

  return {
    profile: profile as string,
    option: option as string,
    location: location as string,
    product: product.id as string,
    variantId: product.variants[0].id as string,
  }
}

export const createSellerProduct = async (
  api: any,
  seller: TestVendor,
  profile: string,
  title: string,
  price: number
) =>
  (
    await must(
      `product ${title}`,
      api.post(
        "/vendors/products",
        {
          title,
          shipping_profile_id: profile,
          options: [{ title: "Size", values: ["M"] }],
          variants: [{ title: "M", options: { Size: "M" }, prices: [{ currency_code: "usd", amount: price }], manage_inventory: false }],
        },
        seller.headers
      )
    )
  ).data.product

/**
 * Builds a cart with the given items, one shipping method per option, a payment
 * session, and completes it through the given endpoint. Items are posted to the
 * given path (the feature routes differ) with the given body.
 */
export type CartItem = { path?: string; body: Record<string, unknown> }

export const completeCart = async (
  api: any,
  storefront: Storefront,
  items: CartItem[],
  options: string[],
  endpoint = "complete-all"
) => {
  const { storeHeaders, regionId, channelId } = storefront
  const cartId = (await must("cart", api.post("/store/carts", { region_id: regionId, sales_channel_id: channelId, email: "buyer@test.local" }, storeHeaders))).data.cart.id
  await must("address", api.post(`/store/carts/${cartId}`, { shipping_address: { first_name: "B", last_name: "Uyer", address_1: "1 St", city: "Town", country_code: "us", postal_code: "10001" } }, storeHeaders))
  for (const item of items) {
    await must("item", api.post(`/store/carts/${cartId}/${item.path ?? "line-items"}`, item.body, storeHeaders))
  }
  for (const optionId of options) {
    await must("method", api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: optionId }, storeHeaders))
  }
  const collection = await must("payment collection", api.post("/store/payment-collections", { cart_id: cartId }, storeHeaders))
  await must(
    "payment session",
    api.post(`/store/payment-collections/${collection.data.payment_collection.id}/payment-sessions`, { provider_id: "pp_system_default" }, storeHeaders)
  )
  const done = await must("complete", api.post(`/store/carts/${cartId}/${endpoint}`, {}, storeHeaders))
  if (done.data.type !== "order") {
    throw new Error(`cart did not complete: ${JSON.stringify(done.data)}`)
  }
  return done.data.order.id as string
}

export const waitFor = async <T>(read: () => Promise<T>, done: (value: T) => boolean, tries = 60, ms = 500) => {
  let value = await read()
  for (let i = 0; i < tries && !done(value); i++) {
    await new Promise((resolve) => setTimeout(resolve, ms))
    value = await read()
  }
  return value
}
