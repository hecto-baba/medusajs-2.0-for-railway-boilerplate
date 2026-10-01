import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { platformManaged } from "../../shared/platform-managed"

export const UpdateVendorTaxRateSchema = z.object({
  rate: z.coerce.number().min(0).max(100),
  name: z.string().optional(),
  code: z.string().optional(),
})

export const DELETE = async () => {
  // Tax regions are platform-owned (decision D6): Medusa allows one per country.
  throw platformManaged("Tax regions")
}

export const POST = async () => {
  // Tax rates are platform-owned (decision D6): sellers can read them, not change them.
  throw platformManaged("Tax rates")
}
