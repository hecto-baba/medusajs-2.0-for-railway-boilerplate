import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import type MarketplaceModuleService from "../../../modules/marketplace/service"
import { DEFAULT_CURRENCIES } from "./currency-data"

export const PostVendorCurrencySchema = z.object({
  code: z.string().min(2).max(5),
  is_default: z.boolean().optional(),
  is_tax_inclusive: z.boolean().optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.metadata"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["supported_currencies.*"],
  })

  const storeCurrencies = stores[0]?.supported_currencies ?? []
  const vendorMetaCurrencies = (vendorAdmin.vendor.metadata?.currencies as any[]) || null

  let currencies: any[] = []
  if (vendorMetaCurrencies && Array.isArray(vendorMetaCurrencies) && vendorMetaCurrencies.length > 0) {
    currencies = vendorMetaCurrencies.map((c) => {
      const codeUpper = (c.code || "").toUpperCase()
      const info = DEFAULT_CURRENCIES[codeUpper] || { name: codeUpper, symbol: codeUpper }
      return {
        code: codeUpper.toLowerCase(),
        name: info.name,
        symbol: info.symbol,
        is_default: Boolean(c.is_default),
        is_tax_inclusive: Boolean(c.is_tax_inclusive),
      }
    })
  } else {
    // Default to store supported currencies
    currencies = storeCurrencies.map((c: any) => {
      const codeUpper = (c.currency_code || "").toUpperCase()
      const info = DEFAULT_CURRENCIES[codeUpper] || { name: codeUpper, symbol: codeUpper }
      return {
        code: codeUpper.toLowerCase(),
        name: info.name,
        symbol: info.symbol,
        is_default: Boolean(c.is_default),
        is_tax_inclusive: false,
      }
    })
  }

  // Ensure at least one default if currencies exist
  if (currencies.length > 0 && !currencies.some((c) => c.is_default)) {
    currencies[0].is_default = true
  }

  res.json({ currencies })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostVendorCurrencySchema>>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const marketplace = req.scope.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.metadata"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["supported_currencies.*"],
  })
  const storeCurrencies = stores[0]?.supported_currencies ?? []

  const currentCurrencies: any[] =
    (vendorAdmin.vendor.metadata?.currencies as any[]) ||
    storeCurrencies.map((c: any) => ({
      code: (c.currency_code || "").toLowerCase(),
      is_default: Boolean(c.is_default),
      is_tax_inclusive: false,
    }))

  const code = req.validatedBody.code.toLowerCase()
  if (currentCurrencies.some((c) => c.code.toLowerCase() === code)) {
    throw new MedusaError(
      MedusaError.Types.DUPLICATE_ERROR,
      `Currency ${code.toUpperCase()} is already configured in your store.`
    )
  }

  const isDefault = Boolean(req.validatedBody.is_default)
  const isTaxInclusive = Boolean(req.validatedBody.is_tax_inclusive)

  const updatedCurrencies = currentCurrencies.map((c) => ({
    ...c,
    is_default: isDefault ? false : c.is_default,
  }))

  const info = DEFAULT_CURRENCIES[code.toUpperCase()] || {
    name: code.toUpperCase(),
    symbol: code.toUpperCase(),
  }

  const newCurrency = {
    code,
    name: info.name,
    symbol: info.symbol,
    is_default: isDefault || updatedCurrencies.length === 0,
    is_tax_inclusive: isTaxInclusive,
  }

  updatedCurrencies.push(newCurrency)

  await marketplace.updateVendors({
    id: vendorAdmin.vendor.id,
    metadata: {
      ...(vendorAdmin.vendor.metadata || {}),
      currencies: updatedCurrencies,
    },
  })

  res.status(201).json({ currency: newCurrency })
}
