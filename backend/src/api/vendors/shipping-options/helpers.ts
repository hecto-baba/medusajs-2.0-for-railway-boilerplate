import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { assertVendorCanSee, ScopedEntity } from "../shared/platform-scope"
import { assertVendorCanUseShippingProfile } from "../shared/shipping-profile-scope"

export const SHIPPING_OPTION_FIELDS = [
  "id",
  "name",
  "price_type",
  "service_zone_id",
  "shipping_profile_id",
  "provider_id",
  "shipping_option_type_id",
  "metadata",
  "created_at",
  "updated_at",
  "type.*",
  "prices.*",
  "prices.price_rules.*",
  "rules.*",
  "service_zone.id",
  "service_zone.name",
  "service_zone.fulfillment_set.id",
  "service_zone.fulfillment_set.location.id",
  "service_zone.fulfillment_set.location.name",
]

const SHIPPING_OPTION_TYPES: ScopedEntity = {
  linkField: "shipping_option_types",
  entity: "shipping_option_type",
}

export const ShippingOptionPriceSchema = z.union([
  z.object({ currency_code: z.string().min(3).max(3), amount: z.number().min(0) }).strict(),
  z.object({ region_id: z.string().min(1), amount: z.number().min(0) }).strict(),
])

// Sellers cannot set rules, `data`, or admin-only / return flags: every seller
// option is a normal storefront option (enabled_in_store, not a return option).
export const CreateVendorShippingOptionSchema = z
  .object({
    name: z.string().min(1),
    service_zone_id: z.string().min(1),
    shipping_profile_id: z.string().min(1),
    shipping_option_type_id: z.string().min(1),
    provider_id: z.string().optional(),
    price_type: z.literal("flat").default("flat"),
    prices: ShippingOptionPriceSchema.array().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

export const UpdateVendorShippingOptionSchema = z
  .object({
    name: z.string().min(1).optional(),
    shipping_profile_id: z.string().min(1).optional(),
    shipping_option_type_id: z.string().min(1).optional(),
    prices: z
      .union([
        z.object({ id: z.string().min(1), amount: z.number().min(0) }).strict(),
        ShippingOptionPriceSchema,
      ])
      .array()
      .min(1)
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

export const GetVendorShippingOptionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  stock_location_id: z.string().optional(),
})

/** Profile and type named in a body must be usable by the seller (own or platform). */
export const assertShippingOptionReferences = async (
  req: AuthenticatedMedusaRequest,
  refs: { shipping_profile_id?: string; shipping_option_type_id?: string }
): Promise<void> => {
  if (refs.shipping_profile_id) {
    await assertVendorCanUseShippingProfile(req, refs.shipping_profile_id)
  }
  if (refs.shipping_option_type_id) {
    await assertVendorCanSee(
      req,
      SHIPPING_OPTION_TYPES,
      refs.shipping_option_type_id,
      "Shipping option type not found."
    )
  }
}

/** Reads one option with its display fields. */
export const refetchShippingOption = async (
  req: AuthenticatedMedusaRequest,
  id: string
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: SHIPPING_OPTION_FIELDS,
    filters: { id },
  })
  return data?.[0]
}
