/**
 * Client-side reads of the vendor API.
 *
 * These go through the app's own /api/vendors proxy rather than to the backend
 * directly: the session token is httpOnly, so only the server can attach it.
 */
export type VendorProduct = {
  subtitle?: string | null
  description?: string | null
  collection?: { id: string; title: string } | null
  sales_channels?: { id: string; name: string | null }[]
  id: string
  title: string
  handle: string | null
  status: string
  thumbnail: string | null
  created_at: string
  updated_at: string
  variants?: { id: string }[]
}

export type VendorOrder = {
  id: string
  display_id: number
  status: string
  created_at: string
  email: string | null
  currency_code: string
  total: number
  customer?: { email: string | null } | null
  sales_channel?: { name: string | null } | null
  payment_collections?: { status: string }[]
  fulfillments?: { id: string; delivered_at: string | null; shipped_at: string | null }[]
}

export type ListResponse<T> = {
  count: number
  limit: number
  offset: number
} & T

const request = async <T>(path: string, params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value))
    }
  }

  const res = await fetch(`/api/vendors/${path}?${search.toString()}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as T
}

export const listVendorProducts = (params: {
  limit: number
  offset: number
  q?: string
}) => request<ListResponse<{ products: VendorProduct[] }>>("products", params)

export const listVendorOrders = (params: { limit: number; offset: number }) =>
  request<ListResponse<{ orders: VendorOrder[] }>>("orders", params)

const mutate = async <T>(
  path: string,
  method: "POST" | "DELETE",
  body?: unknown
) => {
  const res = await fetch(`/api/vendors/${path}`, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as T
}

export const getVendorProduct = async (id: string) => {
  const res = await fetch(`/api/vendors/products/${id}`, {
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.message ?? `Request failed with ${res.status}`)
  }

  return (await res.json()) as { product: VendorProduct }
}

export const createVendorProduct = (body: Record<string, unknown>) =>
  mutate<{ product: VendorProduct }>("products", "POST", body)

export const updateVendorProduct = (id: string, body: Record<string, unknown>) =>
  mutate<{ product: VendorProduct }>(`products/${id}`, "POST", body)

export const deleteVendorProduct = (id: string) =>
  mutate<{ id: string; deleted: boolean }>(`products/${id}`, "DELETE")
