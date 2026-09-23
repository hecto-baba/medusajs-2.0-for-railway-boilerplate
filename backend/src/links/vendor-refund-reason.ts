import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import PaymentModule from "@medusajs/medusa/payment"

/**
 * Same shape as vendor-return-reason.ts. RefundReason is a model inside the
 * Payment module rather than its own module - confirmed via
 * PaymentModule.linkable at runtime.
 */
export default defineLink(
  { linkable: MarketplaceModule.linkable.vendor, deleteCascade: true },
  { linkable: PaymentModule.linkable.refundReason.id, isList: true }
)
