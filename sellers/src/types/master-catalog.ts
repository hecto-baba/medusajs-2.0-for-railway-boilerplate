import { z } from "zod"

export const MasterCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  brand: z.string().nullable().optional(),
  priceMin: z.number().nullable().optional(),
  priceMax: z.number().nullable().optional(),
  variantCount: z.number().optional().default(1),
  imageUrl: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
})

export type MasterCatalogItem = z.infer<typeof MasterCatalogItemSchema>

export const MasterCatalogPaginationSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
  total: z.number().optional().default(0),
  totalPages: z.number().optional().default(1),
  hasMore: z.boolean().optional().default(false),
  nextCursor: z.string().nullable().optional(),
})

export type MasterCatalogPagination = z.infer<
  typeof MasterCatalogPaginationSchema
>

export const MasterCatalogSearchResponseSchema = z.object({
  items: z.array(MasterCatalogItemSchema).default([]),
  pagination: MasterCatalogPaginationSchema.optional(),
  nextCursor: z.string().nullable().optional(),
})

export type MasterCatalogSearchResponse = z.infer<
  typeof MasterCatalogSearchResponseSchema
>

export const ProductFacetsResponseSchema = z.object({
  segmentCode: z.string().optional(),
  brands: z
    .array(z.object({ name: z.string(), count: z.number() }))
    .default([]),
  categories: z
    .object({
      l1: z
        .array(z.object({ name: z.string(), count: z.number() }))
        .default([]),
      l2: z
        .array(z.object({ name: z.string(), count: z.number() }))
        .default([]),
      l3: z
        .array(z.object({ name: z.string(), count: z.number() }))
        .default([]),
    })
    .default({ l1: [], l2: [], l3: [] }),
  priceRange: z
    .object({
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
    })
    .optional(),
  statuses: z
    .array(z.object({ status: z.string(), count: z.number() }))
    .optional()
    .default([]),
})

export type ProductFacetsResponse = z.infer<typeof ProductFacetsResponseSchema>

export const UnifiedMasterProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  name: z.string().optional(),
  brand: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  images: z
    .array(
      z.object({
        id: z.string().optional(),
        url: z.string(),
        isPrimary: z.boolean().optional().default(false),
        displayOrder: z.number().optional().default(0),
      })
    )
    .default([]),
  segment: z.object({
    id: z.string().optional(),
    code: z.string(),
    name: z.string().optional(),
  }),
  category: z
    .object({
      id: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      path: z.string().optional(),
    })
    .nullable()
    .optional(),
  priceGuide: z
    .object({
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
      currency: z.string().optional().default("INR"),
    })
    .optional(),
  options: z
    .array(
      z.object({
        title: z.string(),
        values: z.array(z.string()),
      })
    )
    .default([]),
  variants: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        sku: z.string().nullable().optional(),
        barcode: z.string().nullable().optional(),
        options: z.record(z.string(), z.string()).default({}),
        suggestedPrice: z.number().nullable().optional(),
        images: z.array(z.string()).optional().default([]),
      })
    )
    .default([]),
  attributes: z.record(z.string(), z.unknown()).optional().default({}),
})

export type UnifiedMasterProduct = z.infer<typeof UnifiedMasterProductSchema>
