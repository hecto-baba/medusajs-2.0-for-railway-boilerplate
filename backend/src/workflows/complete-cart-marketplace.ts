import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  completeCartWorkflow,
  createRemoteLinkStep,
  emitEventStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { TICKET_BOOKING_MODULE } from "../modules/ticket-booking"
import { APPOINTMENT_BOOKING_MODULE } from "../modules/appointment-booking"
import { DIGITAL_PRODUCT_MODULE } from "../modules/digital-product"
import ticketPurchaseOrderLink from "../links/ticket-purchase-order"
import appointmentAttendeeOrderLink from "../links/appointment-attendee-order"
import digitalProductOrderLink from "../links/digital-product-order"
import { validateTicketOrderStep, ValidateTicketOrderStepInput } from "./steps/validate-ticket-order"
import { createTicketPurchasesStep, CreateTicketPurchasesStepInput } from "./steps/create-ticket-purchases"
import { validateRentalStep, ValidateRentalInput } from "./steps/validate-rental"
import { createRentalsForOrderStep, CreateRentalsForOrderInput } from "./steps/create-rentals-for-order"
import { validateAppointmentHoldsStep } from "./steps/validate-appointment-holds"
import {
  confirmAppointmentAttendeesStep,
  ConfirmAppointmentAttendeesInput,
} from "./steps/confirm-appointment-attendees"
import { createEoiForOrderStep, CreateEoiForOrderInput } from "./steps/create-eoi-for-order"
import createDigitalProductOrderStep from "./create-digital-product-order/steps/create-digital-product-order"

export type CompleteCartMarketplaceWorkflowInput = {
  cart_id: string
}

/**
 * The ONE way a cart becomes an order (Phase 3, step 4).
 *
 * The storefront used to choose between four completion endpoints (tickets,
 * rentals, digital, standard) by looking at the cart, so a cart mixing, say, a
 * ticket and a rental could only complete one of the two, and appointments and
 * expressions of interest had no storefront path at all. This runs the core
 * completeCartWorkflow once, then every feature's own steps for whatever the
 * cart actually contains. Each block is skipped when the cart has no such item
 * or when its records already exist, so a retry never books twice.
 *
 * Seller orders are created afterwards by the order.placed subscriber (see
 * lib/split-order.ts); those records belong to the parent order, which is the
 * order the buyer sees.
 */
export const completeCartMarketplaceWorkflow = createWorkflow(
  "complete-cart-marketplace",
  (input: CompleteCartMarketplaceWorkflowInput) => {
    acquireLockStep({ key: input.cart_id, timeout: 2, ttl: 10 })

    // Appointments are reserved when they go into the cart, so the only thing to
    // check here is that each hold is still the buyer's - and it is checked
    // BEFORE the order is created, so a lapsed reservation is reported while
    // nothing has been finalised, never after.
    validateAppointmentHoldsStep({ cart_id: input.cart_id })

    const order = completeCartWorkflow.runAsStep({ input: { id: input.cart_id } })

    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: [
        "id",
        "customer_id",
        "items.id",
        "items.quantity",
        "items.metadata",
        "items.variant_id",
        "items.variant.id",
        "items.variant.product_id",
        "items.variant.options.value",
        "items.variant.options.option.title",
        "items.variant.ticket_product_variant.*",
        "items.variant.ticket_product_variant.purchases.*",
        "items.variant.product.rental_configuration.*",
      ],
      filters: { id: input.cart_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "retrieve-cart-for-marketplace-completion" })

    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "subtotal",
        "tax_total",
        "discount_total",
        "created_at",
        "customer_id",
        "customer.*",
        "billing_address.*",
        "shipping_address.*",
        "items.*",
        "items.variant.*",
        "items.variant.digital_product.*",
        "items.variant.product.rental_configuration.*",
      ],
      filters: { id: order.id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "retrieve-order-for-marketplace-completion" })

    // ---- tickets
    const ticketItems = transform({ carts }, (data) =>
      (data.carts[0].items ?? []).filter((item: any) => !!item?.metadata?.seat_number)
    )
    const { data: ticketLinks } = useQueryGraphStep({
      entity: ticketPurchaseOrderLink.entryPoint,
      fields: ["ticket_purchase_id"],
      filters: { order_id: order.id },
    }).config({ name: "retrieve-existing-ticket-links-marketplace" })

    when(
      { ticketLinks, ticketItems },
      (data) => data.ticketLinks.length === 0 && data.ticketItems.length > 0
    ).then(() => {
      validateTicketOrderStep({
        items: carts[0].items,
        order_id: order.id,
      } as unknown as ValidateTicketOrderStepInput)

      const ticketPurchases = createTicketPurchasesStep({
        order_id: order.id,
        items: carts[0].items,
      } as unknown as CreateTicketPurchasesStepInput)

      createRemoteLinkStep(
        transform({ order, ticketPurchases }, (data) =>
          data.ticketPurchases.map((purchase: any) => ({
            [TICKET_BOOKING_MODULE]: { ticket_purchase_id: purchase.id },
            [Modules.ORDER]: { order_id: data.order.id },
          }))
        )
      ).config({ name: "link-ticket-purchases-marketplace" })
    })

    // ---- rentals
    const rentalItems = transform({ carts }, (data) => {
      const list: Record<string, unknown>[] = []
      for (const item of (data.carts[0].items ?? []) as any[]) {
        const config = item?.variant?.product?.rental_configuration
        if (item?.variant && config && config.status === "active") {
          const metadata = item.metadata || {}
          list.push({
            line_item_id: item.id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            rental_configuration: config,
            rental_start_date: metadata.rental_start_date,
            rental_end_date: metadata.rental_end_date,
            rental_days: metadata.rental_days,
            rental_units_count: metadata.rental_units_count,
          })
        }
      }
      return list
    })
    const { data: rentals } = useQueryGraphStep({
      entity: "rental",
      fields: ["id"],
      filters: { order_id: order.id },
    }).config({ name: "retrieve-existing-rentals-marketplace" })

    when(
      { rentals, rentalItems },
      (data) => data.rentals.length === 0 && data.rentalItems.length > 0
    ).then(() => {
      validateRentalStep({
        rental_items: rentalItems,
        order_id: order.id,
      } as unknown as ValidateRentalInput)
      createRentalsForOrderStep({ order: orders[0] } as unknown as CreateRentalsForOrderInput)
    })

    // ---- appointments
    const appointmentItems = transform({ carts }, (data) =>
      (data.carts[0].items ?? []).filter((item: any) => !!item?.metadata?.appointment_id)
    )
    const { data: attendeeLinks } = useQueryGraphStep({
      entity: appointmentAttendeeOrderLink.entryPoint,
      fields: ["appointment_attendee_id"],
      filters: { order_id: order.id },
    }).config({ name: "retrieve-existing-attendee-links-marketplace" })

    when(
      { attendeeLinks, appointmentItems },
      (data) => data.attendeeLinks.length === 0 && data.appointmentItems.length > 0
    ).then(() => {
      // Confirms the places held at add-to-cart; nothing new is claimed here, so
      // there is no post-payment availability check to fail.
      const attendees = confirmAppointmentAttendeesStep({
        order_id: order.id,
        items: appointmentItems,
      } as unknown as ConfirmAppointmentAttendeesInput)

      createRemoteLinkStep(
        transform({ order, attendees }, (data) =>
          data.attendees.map((attendee: any) => ({
            [APPOINTMENT_BOOKING_MODULE]: { appointment_attendee_id: attendee.id },
            [Modules.ORDER]: { order_id: data.order.id },
          }))
        )
      ).config({ name: "link-appointment-attendees-marketplace" })

      // Confirmation emails go out on this event rather than on order.placed,
      // which fires from inside the core completion - before the places above
      // are confirmed. This block runs once per order (guarded by the existing
      // attendee-link check), so the event is emitted once.
      emitEventStep({
        eventName: "appointment.booked",
        data: { order_id: order.id },
      }).config({ name: "emit-appointment-booked-marketplace" })
    })

    // ---- expressions of interest
    const hasEoiItems = transform({ carts }, (data) =>
      (data.carts[0].items ?? []).some((item: any) => item?.metadata?.is_eoi === true)
    )
    const { data: eois } = useQueryGraphStep({
      entity: "eoi",
      fields: ["id"],
      filters: { order_id: order.id },
    }).config({ name: "retrieve-existing-eois-marketplace" })

    when({ eois, hasEoiItems }, (data) => data.eois.length === 0 && data.hasEoiItems).then(() => {
      createEoiForOrderStep({ order: orders[0] } as unknown as CreateEoiForOrderInput)
    })

    // ---- digital products
    const digitalItems = transform({ orders }, (data) =>
      (data.orders[0].items ?? []).filter((item: any) => item?.variant?.digital_product !== undefined)
    )
    const { data: digitalLinks } = useQueryGraphStep({
      entity: digitalProductOrderLink.entryPoint,
      fields: ["digital_product_order_id"],
      filters: { order_id: order.id },
    }).config({ name: "retrieve-existing-digital-links-marketplace" })

    when(
      { digitalLinks, digitalItems },
      (data) => data.digitalLinks.length === 0 && data.digitalItems.length > 0
    ).then(() => {
      const { digital_product_order } = createDigitalProductOrderStep({ items: digitalItems })

      createRemoteLinkStep([
        {
          [DIGITAL_PRODUCT_MODULE]: { digital_product_order_id: digital_product_order.id },
          [Modules.ORDER]: { order_id: order.id },
        },
      ]).config({ name: "link-digital-product-order-marketplace" })

      emitEventStep({
        eventName: "digital_product_order.created",
        data: { id: digital_product_order.id, order_id: order.id },
      }).config({ name: "emit-digital-product-order-created-marketplace" })
    })

    releaseLockStep({ key: input.cart_id })

    return new WorkflowResponse({ order: orders[0] })
  }
)
