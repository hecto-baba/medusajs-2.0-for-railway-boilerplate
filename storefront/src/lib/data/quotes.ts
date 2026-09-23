"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCartId } from "./cookies"
import { revalidatePath } from "next/cache"

export const listCustomerQuotes = async () => {
  const headers = await getAuthHeaders()
  const cartId = await getCartId()
  const query = cartId ? `?cart_id=${cartId}` : ""

  try {
    const res = await sdk.client.fetch<any>(`/store/customers/me/quotes${query}`, {
      method: "GET",
      headers,
    })
    if (res.quotes && res.quotes.length > 0) {
      return res.quotes
    }
  } catch (e) {
    // fallback to /store/quotes
  }

  try {
    const res = await sdk.client.fetch<any>(`/store/quotes${query}`, {
      method: "GET",
      headers,
    })
    return res.quotes || []
  } catch (error) {
    return []
  }
}

export const requestQuote = async (payload: {
  cartId: string
  target_price?: number
  note?: string
  delivery_mode?: string
  vehicle_note?: string
  target_shipping_price?: number
  items?: {
    id: string
    quantity: number
    target_unit_price?: number
  }[]
}) => {
  const headers = await getAuthHeaders()
  const {
    cartId,
    target_price,
    note,
    delivery_mode,
    vehicle_note,
    target_shipping_price,
    items,
  } = payload
  try {
    const res = await sdk.client.fetch<any>("/store/customers/me/quotes", {
      method: "POST",
      headers,
      body: {
        cart_id: cartId,
        target_price: target_price ? Number(target_price) : undefined,
        note,
        delivery_mode,
        vehicle_note,
        target_shipping_price:
          typeof target_shipping_price === "number"
            ? Number(target_shipping_price)
            : undefined,
        items,
      },
    })
    revalidatePath("/[countryCode]/account/quotes", "page")
    return { success: true, quote: res.quote }
  } catch (e: any) {
    // fallback to /store/quotes
    try {
      const res = await sdk.client.fetch<any>("/store/quotes", {
        method: "POST",
        headers,
        body: {
          cart_id: cartId,
          target_price: target_price ? Number(target_price) : undefined,
          note,
          delivery_mode,
          vehicle_note,
          target_shipping_price:
            typeof target_shipping_price === "number"
              ? Number(target_shipping_price)
              : undefined,
          items,
        },
      })
      revalidatePath("/[countryCode]/account/quotes", "page")
      return { success: true, quote: res.quote }
    } catch (fallbackErr: any) {
      return {
        success: false,
        error: fallbackErr.message || e.message || "Failed to request quote",
      }
    }
  }
}

export const previewQuote = async (quoteId: string) => {
  const headers = await getAuthHeaders()
  try {
    const res = await sdk.client.fetch<any>(
      `/store/customers/me/quotes/${quoteId}/preview`,
      {
        method: "GET",
        headers,
      }
    )
    return res
  } catch (error) {
    return null
  }
}

export const acceptQuote = async (quoteId: string) => {
  const headers = await getAuthHeaders()
  try {
    const res = await sdk.client.fetch<any>(
      `/store/quotes/${quoteId}/accept`,
      {
        method: "POST",
        headers,
      }
    )
    revalidatePath("/[countryCode]/account/quotes", "page")
    revalidatePath("/[countryCode]/account/orders", "page")
    return { success: true, data: res }
  } catch (error: any) {
    try {
      const res = await sdk.client.fetch<any>(
        `/store/customers/me/quotes/${quoteId}/accept`,
        {
          method: "POST",
          headers,
        }
      )
      revalidatePath("/[countryCode]/account/quotes", "page")
      revalidatePath("/[countryCode]/account/orders", "page")
      return { success: true, data: res }
    } catch (fallbackErr: any) {
      return {
        success: false,
        error: fallbackErr.message || error.message || "Failed to accept quote",
      }
    }
  }
}

export const rejectQuote = async (quoteId: string) => {
  const headers = await getAuthHeaders()
  try {
    const res = await sdk.client.fetch<any>(
      `/store/quotes/${quoteId}/reject`,
      {
        method: "POST",
        headers,
      }
    )
    revalidatePath("/[countryCode]/account/quotes", "page")
    return { success: true, data: res }
  } catch (error: any) {
    try {
      const res = await sdk.client.fetch<any>(
        `/store/customers/me/quotes/${quoteId}/reject`,
        {
          method: "POST",
          headers,
        }
      )
      revalidatePath("/[countryCode]/account/quotes", "page")
      return { success: true, data: res }
    } catch (fallbackErr: any) {
      return {
        success: false,
        error: fallbackErr.message || error.message || "Failed to reject quote",
      }
    }
  }
}

export const sendCustomerQuoteMessage = async (quoteId: string, text: string) => {
  const headers = await getAuthHeaders()
  try {
    const res = await sdk.client.fetch<any>(
      `/store/quotes/${quoteId}/messages`,
      {
        method: "POST",
        headers,
        body: { text },
      }
    )
    revalidatePath("/[countryCode]/account/quotes", "page")
    return { success: true, message: res.message }
  } catch (error: any) {
    try {
      const res = await sdk.client.fetch<any>(
        `/store/customers/me/quotes/${quoteId}/messages`,
        {
          method: "POST",
          headers,
          body: { text },
        }
      )
      revalidatePath("/[countryCode]/account/quotes", "page")
      return { success: true, message: res.message }
    } catch (fallbackErr: any) {
      return {
        success: false,
        error: fallbackErr.message || error.message || "Failed to send message",
      }
    }
  }
}


