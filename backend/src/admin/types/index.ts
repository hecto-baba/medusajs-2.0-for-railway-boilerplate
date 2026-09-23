import type { ProductVariantDTO, ProductDTO } from "@medusajs/framework/types"

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

export type ProductVariantWithProduct = ProductVariantDTO & {
  product?: ProductDTO
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
