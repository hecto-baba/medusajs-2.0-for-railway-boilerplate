"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { omit } from "lodash"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheDirectives,
  getCartId,
  getSaveAddressChoice,
  removeCartId,
  revalidateCacheTag,
  setCartId,
  setSaveAddressChoice,
} from "./cookies"
import compareAddresses from "@lib/util/compare-addresses"
import type { CartConflict, CartResult } from "@lib/util/cart-conflict"
import { getCustomer } from "./customer"
import { getProductsById } from "./products"
import { getRegion } from "./regions"

/**
 * The cart is cached under a tag scoped to this visitor, and every mutation
 * below invalidates it.
 *
 * This went through two wrong designs first, so the reasoning is worth
 * keeping. Originally the cart was cached under the bare global tag "cart".
 * That was wrong twice over: one shopper's write purged every shopper's cart,
 * and the tag never reached Next at all, because it was passed in the SDK's
 * headers slot (see regions.ts). With nothing registered under the tag,
 * revalidateTag had nothing to invalidate.
 *
 * The reaction was to stop caching the cart entirely. That fixed the stale
 * reads but removed the very thing revalidation acts on, so after a write the
 * App Router was not reliably told to re-render. The visible symptom was the
 * nav badge keeping its old count after roughly one add in fifteen, recovered
 * only by a reload.
 *
 * Caching it under a per-visitor tag is what makes both halves work: the read
 * is a real cache entry, so revalidateTag has something to purge and the
 * router re-renders, and the tag is scoped, so it purges one person's cart.
 */
export async function retrieveCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return null
  }

  return await sdk.client
    .fetch<{ cart: HttpTypes.StoreCart }>(`/store/carts/${cartId}`, {
      method: "GET",
      headers: { ...(await getAuthHeaders()) },
      ...(await getCacheDirectives("carts")),
    })
    .then(({ cart }) => cart)
    .catch(() => {
      return null
    })
}

export async function getOrSetCart(countryCode: string) {
  let cart = await retrieveCart()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  if (!cart) {
    const cartResp = await sdk.store.cart.create({ region_id: region.id })
    cart = cartResp.cart
    await setCartId(cart.id)
    await revalidateCacheTag("carts")
  }

  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(
      cart.id,
      { region_id: region.id },
      {},
      await getAuthHeaders()
    )
    await revalidateCacheTag("carts")
  }

  return cart
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("No existing cart found, please create one before updating")
  }

  return sdk.store.cart
    .update(cartId, data, {}, await getAuthHeaders())
    .then(async ({ cart }) => {
      await revalidateCacheTag("carts")
      return cart
    })
    .catch(medusaError)
}

type AddToCartInput = {
  variantId: string
  quantity: number
  countryCode: string
  metadata?: Record<string, any>
  isDigital?: boolean
}

// Messages here are shown to shoppers, so they must not carry ids or backend
// detail. The real error is already logged by medusaError / the catch below.
const friendlyAddError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : ""
  if (/stock location|inventory|out of stock/i.test(message)) {
    return "This item is currently unavailable."
  }
  if (/could not reach the store/i.test(message)) {
    return "Could not reach the store. Please try again."
  }
  return "We couldn't add this item to your cart. Please try again."
}

export async function addToCart(input: AddToCartInput): Promise<CartResult> {
  try {
    return await addToCartOrThrow(input)
  } catch (error) {
    console.error("addToCart failed:", error)
    return { error: friendlyAddError(error) }
  }
}

async function addToCartOrThrow({
  variantId,
  quantity,
  countryCode,
  metadata,
  isDigital,
}: AddToCartInput): Promise<CartConflict | void> {
  if (!variantId) {
    throw new Error("Missing variant ID when adding to cart")
  }

  const cart = await getOrSetCart(countryCode)
  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  // 1. Single-Restaurant & Separation Cart Validation
  const existingRestaurantId = (cart.metadata?.restaurant_id as string) || undefined
  const hasRestaurantItems = (cart.items || []).some((item) => !!item.metadata?.restaurant_id)
  const hasRetailItems = (cart.items || []).some((item) => !item.metadata?.restaurant_id)

  if (metadata?.restaurant_id) {
    // Attempting to add a restaurant food dish
    if (hasRetailItems) {
      return {
        conflict: "CONFLICT_RETAIL_EXISTS",
        message:
          "Your cart contains standard store products. Food delivery orders cannot be combined with standard retail merchandise.",
      }
    }

    if (existingRestaurantId && existingRestaurantId !== metadata.restaurant_id) {
      return {
        conflict: "CONFLICT_RESTAURANT_EXISTS",
        message: `Your cart already contains items from ${
          cart.metadata?.restaurant_name || "another restaurant"
        }. Orders can only be placed from one restaurant at a time.`,
      }
    }

    if (!existingRestaurantId) {
      await sdk.store.cart.update(
        cart.id,
        {
          metadata: {
            ...cart.metadata,
            restaurant_id: metadata.restaurant_id,
            restaurant_name: metadata.restaurant_name || "Restaurant",
          },
        },
        {},
        await getAuthHeaders()
      )
    }
  } else {
    // Attempting to add a standard store product
    if (hasRestaurantItems || existingRestaurantId) {
      return {
        conflict: "CONFLICT_FOOD_EXISTS",
        message:
          "Your cart contains food items from a restaurant. Standard retail products cannot be combined with restaurant food delivery orders.",
      }
    }
  }

  // A digital download is delivered by email, so its line is created by a
  // dedicated route that marks it as needing no shipping. Medusa's own
  // add-to-cart would leave it needing an address and a shipping method.
  if (isDigital) {
    await sdk.client
      .fetch(`/store/carts/${cart.id}/line-items/digital`, {
        method: "POST",
        body: { variant_id: variantId, quantity },
        headers: { ...(await getAuthHeaders()) },
      })
      .then(async () => {
        await revalidateCacheTag("carts")
      })
      .catch(medusaError)
    return
  }

  await sdk.store.cart
    .createLineItem(
      cart.id,
      {
        variant_id: variantId,
        quantity,
        metadata,
      },
      {},
      await getAuthHeaders()
    )
    .then(async () => {
      await revalidateCacheTag("carts")
    })
    .catch(medusaError)
}

export async function updateLineItem({
  lineId,
  quantity,
}: {
  lineId: string
  quantity: number
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item")
  }

  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("Missing cart ID when updating line item")
  }

  await sdk.store.cart
    .updateLineItem(cartId, lineId, { quantity }, {}, await getAuthHeaders())
    .then(async () => {
      await revalidateCacheTag("carts")
    })
    .catch(medusaError)
}

export async function deleteLineItem(lineId: string) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("Missing cart ID when deleting line item")
  }

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, await getAuthHeaders())
    .then(async () => {
      await revalidateCacheTag("carts")
    })
    .catch(medusaError)

  // Taking out the last dish must also take off the restaurant tag, or the next
  // thing put in this cart (a booking, a rental) would inherit it. The cart is
  // read again after the delete rather than worked out from an earlier copy:
  // two dishes removed together would each see the other still there.
  // The item is already gone, so a failure here is logged, not shown.
  try {
    const cart = await retrieveCart()
    if (
      cart?.metadata?.restaurant_id &&
      !(cart.items ?? []).some((item) => item.metadata?.restaurant_id)
    ) {
      await sdk.store.cart.update(
        cartId,
        { metadata: { ...cart.metadata, restaurant_id: null, restaurant_name: null } },
        {},
        await getAuthHeaders()
      )
      await revalidateCacheTag("carts")
    }
  } catch (err) {
    console.error("Failed to clear the restaurant tag from the cart:", err)
  }
}

export async function clearCart() {
  const cart = await retrieveCart()
  if (!cart) return

  if (cart.items && cart.items.length > 0) {
    for (const item of cart.items) {
      try {
        await sdk.store.cart.deleteLineItem(cart.id, item.id, {}, await getAuthHeaders())
      } catch {}
    }
  }

  await sdk.store.cart.update(
    cart.id,
    {
      metadata: {
        ...cart.metadata,
        restaurant_id: null,
        restaurant_name: null,
      },
    },
    {},
    await getAuthHeaders()
  )

  await revalidateCacheTag("carts")
}

export async function clearCartAndAdd({
  variantId,
  quantity,
  countryCode,
  metadata,
}: {
  variantId: string
  quantity: number
  countryCode: string
  metadata?: Record<string, any>
}): Promise<CartResult> {
  try {
    await clearCart()
  } catch (error) {
    console.error("clearCart failed:", error)
    return { error: "We couldn't clear your cart. Please try again." }
  }
  return await addToCart({
    variantId,
    quantity,
    countryCode,
    metadata,
  })
}

export async function enrichLineItems(
  lineItems:
    | HttpTypes.StoreCartLineItem[]
    | HttpTypes.StoreOrderLineItem[]
    | null,
  regionId: string
) {
  if (!lineItems) return []

  // Prepare query parameters
  const queryParams = {
    ids: lineItems.map((lineItem) => lineItem.product_id!),
    regionId: regionId,
  }

  // Fetch products by their IDs
  const products = await getProductsById(queryParams)
  // If there are no line items or products, return an empty array
  if (!lineItems?.length || !products) {
    return []
  }

  // Enrich line items with product and variant information
  const enrichedItems = lineItems.map((item) => {
    const product = products.find((p: any) => p.id === item.product_id)
    const variant = product?.variants?.find(
      (v: any) => v.id === item.variant_id
    )

    // If product or variant is not found, return the original item
    if (!product || !variant) {
      return item
    }

    // If product and variant are found, enrich the item
    return {
      ...item,
      variant: {
        ...variant,
        product: omit(product, "variants"),
      },
    }
  }) as HttpTypes.StoreCartLineItem[]

  return enrichedItems
}

export async function setShippingMethod({
  cartId,
  shippingMethodId,
}: {
  cartId: string
  shippingMethodId: string
}) {
  return sdk.store.cart
    .addShippingMethod(
      cartId,
      { option_id: shippingMethodId },
      {},
      await getAuthHeaders()
    )
    .then(async () => {
      await revalidateCacheTag("carts")
    })
    .catch(medusaError)
}

export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: {
    provider_id: string
    context?: Record<string, unknown>
  }
) {
  return sdk.store.payment
    .initiatePaymentSession(cart, data, {}, await getAuthHeaders())
    .then(async (resp) => {
      await revalidateCacheTag("carts")
      return resp
    })
    .catch(medusaError)
}

export async function applyPromotions(codes: string[]) {
  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("No existing cart found")
  }

  await updateCart({ promo_codes: codes }).catch(medusaError)

  // A discount moves the cart total, and shipping options can be priced
  // against it, so the options have to be refetched too. Upstream does the
  // same thing here under its "fulfillment" tag; this repo calls that tag
  // "shipping". See lib/data/fulfillment.ts.
  await revalidateCacheTag("shipping")
}

export async function applyGiftCard(code: string) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, { gift_cards: [{ code }] }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function removeDiscount(code: string) {
  // const cartId = getCartId()
  // if (!cartId) return "No cartId cookie found"
  // try {
  //   await deleteDiscount(cartId, code)
  //   revalidateTag("cart")
  // } catch (error: any) {
  //   throw error
  // }
}

export async function removeGiftCard(
  codeToRemove: string,
  giftCards: any[]
  // giftCards: GiftCard[]
) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, {
  //       gift_cards: [...giftCards]
  //         .filter((gc) => gc.code !== codeToRemove)
  //         .map((gc) => ({ code: gc.code })),
  //     }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData
) {
  const code = formData.get("code")?.toString().trim()

  if (!code) {
    return "Enter a promotion code."
  }

  try {
    // promo_codes replaces the whole set, so the codes already on the cart
    // have to be sent along with the new one. Reading them here rather than
    // from the client keeps this correct even if the rendered cart is stale.
    const cart = await retrieveCart()
    const existing = (cart?.promotions ?? [])
      .map((promotion) => promotion.code)
      .filter((promotionCode): promotionCode is string => Boolean(promotionCode))

    if (existing.includes(code)) {
      return "That promotion code is already applied."
    }

    await applyPromotions([...existing, code])
  } catch (e: any) {
    return e.message
  }
}

/**
 * Adds the shipping address to a signed-in customer's address book so the next
 * order can start from it. Skipped for guests, and when the same address is
 * already saved, so ordering twice does not pile up duplicates.
 *
 * Never throws: a failed save must not stop the shopper from checking out.
 */
async function saveAddressToBook(address: HttpTypes.StoreCartAddress) {
  try {
    // A cart that began as a no-shipping order only carries a name and a
    // country; that is not an address worth keeping.
    if (!address?.address_1) return

    const customer = await getCustomer()
    if (!customer) return

    // Only the address fields. A cart's address also carries its own id and
    // timestamps, which must not be copied into the address book. Blank and
    // missing fields compare equal, as the book stores one and the form
    // submits the other.
    const normalise = (a: Record<string, any>) =>
      Object.fromEntries(
        [
          "first_name",
          "last_name",
          "company",
          "address_1",
          "address_2",
          "city",
          "postal_code",
          "province",
          "country_code",
          "phone",
        ].map((k) => [k, typeof a[k] === "string" ? a[k] : ""])
      )
    const wanted = normalise(address)

    const alreadySaved = (customer.addresses ?? []).some((saved) =>
      compareAddresses(normalise(saved as any), wanted)
    )
    if (alreadySaved) return

    await sdk.store.customer.createAddress(
      wanted as any,
      {},
      await getAuthHeaders()
    )
    await revalidateCacheTag("customers")
  } catch {
    // Saving is a convenience; the order itself must go on.
  }
}

// TODO: Pass a POJO instead of a form entity here
export async function setAddresses(currentState: unknown, formData: FormData) {
  // Tickets are delivered by email, so such a cart collects a billing address
  // only and skips the delivery step entirely. Tracked here so the redirect
  // below, which must sit outside the try, knows where to send the shopper.
  const isTicketsOnly = formData?.get("tickets_only") === "true"

  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses")
    }
    const cartId = await getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting addresses")
    }

    const data = {
      shipping_address: {
        first_name: formData.get("shipping_address.first_name"),
        last_name: formData.get("shipping_address.last_name"),
        address_1: formData.get("shipping_address.address_1"),
        address_2: (formData.get("shipping_address.address_2") as string) || "",
        company: formData.get("shipping_address.company"),
        postal_code: formData.get("shipping_address.postal_code"),
        city: formData.get("shipping_address.city"),
        country_code: formData.get("shipping_address.country_code"),
        province: formData.get("shipping_address.province"),
        phone: formData.get("shipping_address.phone"),
      },
      email: formData.get("email"),
    } as any

    // Medusa still wants a shipping address on the cart, so for a ticket cart
    // the billing address stands in for both rather than leaving the cart
    // half-addressed.
    if (isTicketsOnly) {
      // Only what the contact form collects: a name, an optional phone and a
      // country. Fields the shopper was never asked for are left off rather
      // than sent as empty strings, so nothing blank overwrites an address
      // already on the cart.
      const billingAddress = Object.fromEntries(
        [
          "first_name",
          "last_name",
          "address_1",
          "address_2",
          "company",
          "postal_code",
          "city",
          "country_code",
          "province",
          "phone",
        ]
          .map((field) => [field, formData.get(`billing_address.${field}`)])
          .filter(([, value]) => typeof value === "string" && value !== "")
      )

      await updateCart({
        billing_address: billingAddress,
        shipping_address: billingAddress,
        email: formData.get("email"),
      } as any)
    } else {
      const sameAsBilling = formData.get("same_as_billing")
      if (sameAsBilling === "on") data.billing_address = data.shipping_address

      if (sameAsBilling !== "on")
        data.billing_address = {
          first_name: formData.get("billing_address.first_name"),
          last_name: formData.get("billing_address.last_name"),
          address_1: formData.get("billing_address.address_1"),
          address_2: (formData.get("billing_address.address_2") as string) || "",
          company: formData.get("billing_address.company"),
          postal_code: formData.get("billing_address.postal_code"),
          city: formData.get("billing_address.city"),
          country_code: formData.get("billing_address.country_code"),
          province: formData.get("billing_address.province"),
          phone: formData.get("billing_address.phone"),
        }

      await updateCart(data)

      // The checkbox is only offered to signed-in customers. The address is not
      // saved yet - the shopper may still abandon the cart - so the choice is
      // remembered and placeOrder acts on it once the order exists.
      await setSaveAddressChoice(
        formData.get("save_address") === "on" ? await getCartId() ?? null : null
      )
    }
  } catch (e: any) {
    return e.message
  }

  // Straight to payment for tickets: there is no delivery step in that
  // checkout, and sending the shopper to one would strand them on an empty
  // section.
  redirect(
    isTicketsOnly
      ? `/${formData.get("billing_address.country_code")}/checkout?step=payment`
      : `/${formData.get("shipping_address.country_code")}/checkout?step=delivery`
  )
}

export async function placeOrder() {
  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("No existing cart found when placing an order")
  }

  const cart = await retrieveCart()

  // One completion endpoint for every cart. It completes the cart once and then
  // records whatever it holds: tickets, rentals, appointments, expressions of
  // interest and digital products. The storefront used to pick one of four
  // endpoints from the cart's contents, so a mixed cart could only complete one
  // kind of item.
  const completeCart = sdk.client.fetch<{ type: string; order: HttpTypes.StoreOrder }>(
    `/store/carts/${cartId}/complete-all`,
    { method: "POST", headers: { ...(await getAuthHeaders()) } }
  )

  const cartRes = await completeCart
    .then(async (cartRes: any) => {
      await revalidateCacheTag("carts")
      // The order list is cached now, so a new order has to purge it or the
      // shopper lands on an account page that does not list what they just
      // bought.
      await revalidateCacheTag("orders")
      return cartRes
    })
    // Returned, not thrown. Next replaces the message of anything a server
    // action throws with a generic "Server Components render" error in
    // production, so the shopper never learned why the order failed.
    .catch((e: any) => {
      try {
        medusaError(e)
      } catch (err: any) {
        return { error: (err?.message as string) || "Could not place the order." }
      }
    })

  if (cartRes && "error" in cartRes) return { error: cartRes.error as string }

  if (cartRes?.type === "order") {
    // Add the delivery address to the customer's address book if they asked for
    // that on the address step. Done only now, with the order placed.
    if ((await getSaveAddressChoice()) === cartId && cart?.shipping_address) {
      await saveAddressToBook(cart.shipping_address)
    }
    await setSaveAddressChoice(null)

    // Ticket orders have no shipping address at all, so the billing address is
    // the fallback here. Without it the redirect used to interpolate
    // "undefined" as the country code and land on a 404.
    const countryCode = (
      cartRes.order.shipping_address?.country_code ??
      cartRes.order.billing_address?.country_code ??
      cart?.region?.countries?.[0]?.iso_2
    )?.toLowerCase()

    // Step 13: Order Delivery Creation on Checkout
    // Only the dishes in the cart say whether this is a food order. The cart's
    // own restaurant_id is a leftover once the dishes are removed, and used to
    // turn a booking or rental into a delivery.
    const restaurantId = (cart?.items ?? []).find((item: any) => item.metadata?.restaurant_id)
      ?.metadata?.restaurant_id as string | undefined

    if (restaurantId) {
      try {
        await sdk.client.fetch(`/store/deliveries`, {
          method: "POST",
          body: {
            cart_id: cartId,
            restaurant_id: restaurantId,
            order_id: cartRes.order.id,
          },
          headers: { ...(await getAuthHeaders()) },
        })
        // The order pages read the delivery id from the order.
        await revalidateCacheTag("orders")
      } catch (err) {
        console.error("Failed to create order delivery workflow:", err)
      }
    }

    await removeCartId()

    // Every order lands on its confirmation; a food order gets a "Track your
    // order" link there.
    redirect(`/${countryCode}/order/confirmed/${cartRes.order.id}`)
  }

  return { cart: cartRes?.cart }
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  if (cartId) {
    await updateCart({ region_id: region.id })
  }

  // Prices, availability and the cart total are all region-dependent, so
  // switching region invalidates the product and region reads too.
  await revalidateCacheTag("regions")
  await revalidateCacheTag("products")

  redirect(`/${countryCode}${currentPath}`)
}
