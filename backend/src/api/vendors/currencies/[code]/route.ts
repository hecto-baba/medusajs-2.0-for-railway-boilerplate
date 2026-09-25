import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_MODULE } from "../../../../modules/marketplace"
import type MarketplaceModuleService from "../../../../modules/marketplace/service"
import { DEFAULT_CURRENCIES } from "../currency-data"

export const PatchVendorCurrencySchema = z.object({
  is_default: z.boolean().optional(),
  is_tax_inclusive: z.boolean().optional(),
})

export const PATCH = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PatchVendorCurrencySchema>>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const marketplace = req.scope.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)
  const code = (req.params.code || "").toLowerCase()

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

  const targetIndex = currentCurrencies.findIndex((c) => c.code.toLowerCase() === code)
  if (targetIndex === -1) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Currency ${code.toUpperCase()} not found.`
    )
  }

  const { is_default, is_tax_inclusive } = req.validatedBody

  const updatedCurrencies = currentCurrencies.map((c, index) => {
    let newDefault = c.is_default
    if (is_default !== undefined) {
      newDefault = index === targetIndex ? is_default : (is_default ? false : c.is_default)
    }
    let newTaxInclusive = c.is_tax_inclusive
    if (index === targetIndex && is_tax_inclusive !== undefined) {
      newTaxInclusive = is_tax_inclusive
    }
    return {
      ...c,
      is_default: newDefault,
      is_tax_inclusive: newTaxInclusive,
    }
  })

  if (!updatedCurrencies.some((c) => c.is_default)) {
    updatedCurrencies[targetIndex].is_default = true
  }

  await marketplace.updateVendors({
    id: vendorAdmin.vendor.id,
    metadata: {
      ...(vendorAdmin.vendor.metadata || {}),
      currencies: updatedCurrencies,
    },
  })

  const info = DEFAULT_CURRENCIES[code.toUpperCase()] || {
    name: code.toUpperCase(),
    symbol: code.toUpperCase(),
  }

  res.json({
    currency: {
      ...updatedCurrencies[targetIndex],
      name: info.name,
      symbol: info.symbol,
    },
  })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const marketplace = req.scope.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)
  const code = (req.params.code || "").toLowerCase()

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

  const target = currentCurrencies.find((c) => c.code.toLowerCase() === code)
  if (!target) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Currency ${code.toUpperCase()} not found.`
    )
  }

  if (target.is_default) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Cannot remove the default currency. Please designate another currency as default first."
    )
  }

  const updatedCurrencies = currentCurrencies.filter((c) => c.code.toLowerCase() !== code)

  await marketplace.updateVendors({
    id: vendorAdmin.vendor.id,
    metadata: {
      ...(vendorAdmin.vendor.metadata || {}),
      currencies: updatedCurrencies,
    },
  })

  res.json({
    id: code,
    object: "currency",
    deleted: true,
  })
}
