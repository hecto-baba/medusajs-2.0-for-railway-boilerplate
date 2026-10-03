import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { EmailTemplates } from "../modules/email-notifications/templates"
import { RESEND_FROM_EMAIL } from "./constants"

/**
 * Tells the buyer when a seller ships or delivers part of their order
 * (Phase 4, step 7).
 *
 * The buyer paid for one order, but each seller ships on their own, so a buyer
 * gets one email per shipment and one per delivery, naming the seller and the
 * items in THAT parcel. The order number shown is the one they know (the parent
 * order, not the seller's child order). Skipped when the seller chose not to
 * notify. A failed email never fails the fulfilment.
 */

export type BuyerFulfillmentEmailKind = "shipped" | "delivered"

export const sendBuyerFulfillmentEmail = async (
  container: MedusaContainer,
  input: { fulfillment_id: string; kind: BuyerFulfillmentEmailKind; no_notification?: boolean }
): Promise<{ sent: boolean; reason?: string }> => {
  if (input.no_notification) {
    return { sent: false, reason: "no_notification" }
  }

  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "labels.tracking_number", "labels.tracking_url", "items.title", "items.quantity", "items.line_item_id"],
    filters: { id: input.fulfillment_id },
  })
  const fulfillment = fulfillments?.[0]
  if (!fulfillment) {
    return { sent: false, reason: "fulfillment_not_found" }
  }

  // The order this fulfilment belongs to, through the order <-> fulfilment link.
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "metadata", "shipping_address.first_name"],
    filters: { fulfillments: { id: input.fulfillment_id } },
  })
  const order = (orders as any[])[0]
  if (!order?.email) {
    return { sent: false, reason: "no_buyer_email" }
  }

  // For a seller's child order, speak about the parent order the buyer knows.
  let orderDisplayId: string | number = order.display_id
  let sellerName: string | null = null
  if (order.metadata?.split_child) {
    if (order.metadata.parent_order_id) {
      const { data: parents } = await query.graph({
        entity: "order",
        fields: ["id", "display_id"],
        filters: { id: order.metadata.parent_order_id },
      })
      orderDisplayId = parents?.[0]?.display_id ?? orderDisplayId
    }
    if (order.metadata.vendor_id) {
      const { data: vendors } = await query.graph({
        entity: "vendor",
        fields: ["id", "name"],
        filters: { id: [order.metadata.vendor_id] },
      })
      sellerName = vendors?.[0]?.name ?? null
    }
  }

  const label = (fulfillment.labels ?? [])[0]
  const items = ((fulfillment.items ?? []) as any[]).map((item) => ({
    title: item.title,
    quantity: Number(item.quantity),
  }))

  const notification: any = container.resolve(Modules.NOTIFICATION)
  try {
    await notification.createNotifications({
      to: order.email,
      channel: "email",
      template: EmailTemplates.FULFILLMENT_UPDATE,
      data: {
        emailOptions: {
          replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
          subject:
            input.kind === "shipped"
              ? `Part of your order #${orderDisplayId} has shipped`
              : `Part of your order #${orderDisplayId} was delivered`,
        },
        kind: input.kind,
        orderDisplayId,
        sellerName,
        customerName: order.shipping_address?.first_name || undefined,
        items,
        trackingNumber: label?.tracking_number || undefined,
        trackingUrl: label?.tracking_url || undefined,
      },
    })
    return { sent: true }
  } catch (error) {
    console.error("Error sending fulfilment email:", error)
    return { sent: false, reason: "provider_error" }
  }
}
