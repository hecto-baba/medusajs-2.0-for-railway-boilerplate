import type {
  AdminCustomer,
  AdminOrder,
  AdminUser,
  FindParams,
  PaginatedResponse,
  StoreCart,
} from "@medusajs/framework/types"

export type AdminQuote = {
  id: string
  status: string
  draft_order_id: string
  order_change_id: string
  cart_id: string
  customer_id: string
  created_at: string
  updated_at: string
  draft_order: AdminOrder
  cart: StoreCart
  customer: AdminCustomer
  metadata?: any
}

export interface QuoteQueryParams extends FindParams {}

export type AdminQuotesResponse = PaginatedResponse<{
  quotes: AdminQuote[]
}>

export type AdminQuoteResponse = {
  quote: AdminQuote
}

export type UpdateQuoteItemParams = {
  itemId: string
  quantity?: number
  unit_price?: number
}

export enum MediaType {
  MAIN = "main",
  PREVIEW = "preview",
}

export type DigitalProductMedia = {
  id: string
  type: MediaType
  fileId: string
  mimeType: string
  url?: string
  digitalProducts?: DigitalProduct
}

export type ProductVariantWithProduct = any & {
  product?: any
  prices?: {
    id?: string
    amount: number
    currency_code: string
  }[]
}

export type DigitalProduct = {
  id: string
  name: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  medias?: DigitalProductMedia[]
  product_variant?: ProductVariantWithProduct | ProductVariantWithProduct[]
}
