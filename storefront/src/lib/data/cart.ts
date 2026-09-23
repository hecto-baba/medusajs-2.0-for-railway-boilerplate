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
  removeCartId,
  revalidateCacheTag,
  setCartId,
} from "./cookies"
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

export async function addToCart({
  variantId,
  quantity,
  countryCode,
  metadata,
}: {
  variantId: string
  quantity: number
  countryCode: string
  metadata?: Record<string, any>
}) {
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
      throw new Error(
        "CONFLICT_RETAIL_EXISTS: Your cart contains standard store products. Food delivery orders cannot be combined with standard retail merchandise."
      )
    }

    if (existingRestaurantId && existingRestaurantId !== metadata.restaurant_id) {
      throw new Error(
        `CONFLICT_RESTAURANT_EXISTS: Your cart already contains items from ${
          cart.metadata?.restaurant_name || "another restaurant"
        }. Orders can only be placed from one restaurant at a time.`
      )
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
      throw new Error(
        "CONFLICT_FOOD_EXISTS: Your cart contains food items from a restaurant. Standard retail products cannot be combined with restaurant food delivery orders."
      )
    }
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
}) {
  await clearCart()
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
      const billingAddress = {
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

  // A cart holding rental items has to complete through the rental route.
  // The standard complete endpoint creates the order but no rental records,
  // which would leave the booked dates looking free to every later shopper
  // and give the activation and cancellation handlers nothing to act on.
  const hasRentalItems = (cart?.items ?? []).some(
    (item) =>
      !!item.metadata?.rental_start_date && !!item.metadata?.rental_end_date
  )

  // A cart holding tickets has to complete through the ticket route for the
  // same reason: the standard endpoint creates the order but no ticket
  // purchases, so the seats would still look free to the next shopper and the
  // confirmation email would have no tickets to send.
  const hasTicketItems = (cart?.items ?? []).some(
    (item) => !!item.metadata?.seat_number && !!item.metadata?.show_date
  )

  const hasDigitalItems = (cart?.items ?? []).some(
    (item: any) =>
      !!item.variant?.digital_product ||
      item.metadata?.is_digital === true
  )

  const completeCart = hasTicketItems
    ? sdk.client.fetch<{ type: string; order: HttpTypes.StoreOrder }>(
        `/store/carts/${cartId}/complete-tickets`,
        { method: "POST", headers: { ...(await getAuthHeaders()) } }
      )
    : hasRentalItems
      ? sdk.client.fetch<{ type: string; order: HttpTypes.StoreOrder }>(
          `/store/rentals/${cartId}`,
          { method: "POST", headers: { ...(await getAuthHeaders()) } }
        )
      : hasDigitalItems
        ? sdk.client.fetch<{ type: string; order: HttpTypes.StoreOrder }>(
            `/store/carts/${cartId}/complete-digital`,
            { method: "POST", headers: { ...(await getAuthHeaders()) } }
          )
        : sdk.store.cart.complete(cartId, {}, await getAuthHeaders())

  const cartRes = await completeCart
    .then(async (cartRes: any) => {
      await revalidateCacheTag("carts")
      // The order list is cached now, so a new order has to purge it or the
      // shopper lands on an account page that does not list what they just
      // bought.
      await revalidateCacheTag("orders")
      return cartRes
    })
    .catch(medusaError)

  if (cartRes?.type === "order") {
    // Ticket orders have no shipping address at all, so the billing address is
    // the fallback here. Without it the redirect used to interpolate
    // "undefined" as the country code and land on a 404.
    const countryCode = (
      cartRes.order.shipping_address?.country_code ??
      cartRes.order.billing_address?.country_code ??
      cart?.region?.countries?.[0]?.iso_2
    )?.toLowerCase()

    // Step 13: Order Delivery Creation on Checkout
    const restaurantId =
      (cart?.metadata?.restaurant_id as string) ||
      (cart?.items ?? []).find((item: any) => item.metadata?.restaurant_id)?.metadata?.restaurant_id

    let deliveryId: string | null = null
    if (restaurantId) {
      try {
        const deliveryRes: any = await sdk.client.fetch(`/store/deliveries`, {
          method: "POST",
          body: {
            cart_id: cartId,
            restaurant_id: restaurantId,
          },
          headers: { ...(await getAuthHeaders()) },
        })
        if (deliveryRes?.delivery?.id) {
          deliveryId = deliveryRes.delivery.id
        }
      } catch (err) {
        console.error("Failed to create order delivery workflow:", err)
      }
    }

    await removeCartId()

    if (deliveryId) {
      redirect(`/${countryCode}/deliveries/${deliveryId}`)
    } else {
      redirect(`/${countryCode}/order/confirmed/${cartRes?.order.id}`)
    }
  }

  return cartRes.cart
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
