import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createInventoryItemsWorkflow,
  createProductsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { PricingTypes } from "@medusajs/framework/types"
import { TICKET_BOOKING_MODULE } from "../modules/ticket-booking"
import { RowType } from "../modules/ticket-booking/models/venue-row"
import { validateVenueAvailabilityStep } from "./steps/validate-venue-availability"
import { createTicketProductsStep } from "./steps/create-ticket-products"
import { createTicketProductVariantsStep } from "./steps/create-ticket-product-variants"

export type CreateTicketProductWorkflowInput = {
  name: string
  description?: string
  venue_id: string
  dates: string[]
  variants: {
    row_type: RowType
    seat_count: number
    prices: PricingTypes.CreateMoneyAmountDTO[]
  }[]
}

export const DATE_OPTION = "Date"
export const ROW_TYPE_OPTION = "Row Type"

const toSku = (parts: (string | number)[]) =>
  parts.join("-").replace(/[^a-zA-Z0-9-]+/g, "-").toUpperCase()

/**
 * Creates a show: one Medusa Product whose variants are the cartesian product
 * of show dates and row types. Each variant gets its own inventory item whose
 * stocked quantity is the seat count of the matching venue rows, so the
 * Inventory Module caps how many seats can sell while the seat map decides
 * which particular seat a shopper gets.
 */
export const createTicketProductWorkflow = createWorkflow(
  "create-ticket-product",
  (input: CreateTicketProductWorkflowInput) => {
    validateVenueAvailabilityStep({
      venue_id: input.venue_id,
      dates: input.dates,
    })

    const { data: venues } = useQueryGraphStep({
      entity: "venue",
      fields: ["id", "name", "address", "rows.*"],
      filters: { id: input.venue_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "retrieve-venues" })

    const { data: stockLocations } = useQueryGraphStep({
      entity: "stock_location",
      fields: ["id"],
    }).config({ name: "retrieve-stock-locations" })

    const { data: salesChannels } = useQueryGraphStep({
      entity: "sales_channel",
      fields: ["id"],
    }).config({ name: "retrieve-sales-channels" })

    const { data: shippingProfiles } = useQueryGraphStep({
      entity: "shipping_profile",
      fields: ["id"],
    }).config({ name: "retrieve-shipping-profiles" })

    // One inventory item per (date, row type), stocked to the seat count given
    // for that tier. That is what stops a show from overselling a section.
    const inventoryItemsData = transform(
      { input, venues, stockLocations },
      (data) => {
        const locationId = data.stockLocations[0]?.id

        return data.input.dates.flatMap((date) =>
          data.input.variants.map((variant) => {
            const seatCount = variant.seat_count

            return {
              sku: toSku(["TICKET", data.input.name, date, variant.row_type]),
              title: `${data.input.name} - ${date} - ${variant.row_type}`,
              // Tickets are never shipped: this keeps them out of fulfilment
              // and lets the storefront skip the shipping steps entirely.
              requires_shipping: false,
              location_levels: locationId
                ? [{ location_id: locationId, stocked_quantity: seatCount }]
                : [],
            }
          })
        )
      }
    )

    const inventoryItems = createInventoryItemsWorkflow.runAsStep({
      input: { items: inventoryItemsData },
    })

    const productData = transform(
      { input, inventoryItems, salesChannels, shippingProfiles },
      (data) => {
        const variants = data.input.dates.flatMap((date, dateIndex) =>
          data.input.variants.map((variant, variantIndex) => {
            const inventoryItem =
              data.inventoryItems[
                dateIndex * data.input.variants.length + variantIndex
              ]

            return {
              title: `${date} - ${variant.row_type}`,
              sku: toSku(["TICKET", data.input.name, date, variant.row_type]),
              manage_inventory: true,
              allow_backorder: false,
              prices: variant.prices,
              options: {
                [DATE_OPTION]: date,
                [ROW_TYPE_OPTION]: variant.row_type,
              },
              inventory_items: [
                {
                  inventory_item_id: inventoryItem.id,
                  required_quantity: 1,
                },
              ],
            }
          })
        )

        return [
          {
            title: data.input.name,
            description: data.input.description,
            status: "published" as const,
            shipping_profile_id: data.shippingProfiles[0]?.id,
            sales_channels: data.salesChannels.map((channel) => ({
              id: channel.id,
            })),
            options: [
              {
                title: DATE_OPTION,
                values: data.input.dates,
              },
              {
                title: ROW_TYPE_OPTION,
                values: data.input.variants.map((variant) => variant.row_type),
              },
            ],
            variants,
          },
        ]
      }
    )

    const products = createProductsWorkflow.runAsStep({
      input: { products: productData as any },
    })

    const ticketProductsData = transform({ input, products }, (data) => [
      {
        product_id: data.products[0].id,
        venue_id: data.input.venue_id,
        dates: data.input.dates,
      },
    ])

    const ticketProducts = createTicketProductsStep({
      ticket_products: ticketProductsData,
    })

    // Each created product variant is matched back to its row type through the
    // "Row Type" option, so a variant always resolves to the right seating tier.
    const ticketVariantsData = transform(
      { products, ticketProducts },
      (data) =>
        (data.products[0].variants || []).map((variant: any) => ({
          ticket_product_id: data.ticketProducts[0].id,
          product_variant_id: variant.id,
          row_type: (variant.options || []).find(
            (option: any) => option.option?.title === ROW_TYPE_OPTION
          )?.value as RowType,
        }))
    )

    const ticketVariants = createTicketProductVariantsStep({
      variants: ticketVariantsData,
    })

    const linkData = transform(
      { products, ticketProducts, ticketVariants },
      (data) => [
        {
          [TICKET_BOOKING_MODULE]: {
            ticket_product_id: data.ticketProducts[0].id,
          },
          [Modules.PRODUCT]: {
            product_id: data.products[0].id,
          },
        },
        ...data.ticketVariants.map((ticketVariant) => ({
          [TICKET_BOOKING_MODULE]: {
            ticket_product_variant_id: ticketVariant.id,
          },
          [Modules.PRODUCT]: {
            product_variant_id: ticketVariant.product_variant_id,
          },
        })),
      ]
    )

    createRemoteLinkStep(linkData)

    const { data: created } = useQueryGraphStep({
      entity: "ticket_product",
      fields: [
        "id",
        "product_id",
        "dates",
        "venue.*",
        "venue.rows.*",
        "variants.*",
        "product.*",
      ],
      filters: { id: ticketProducts[0].id },
    }).config({ name: "retrieve-created-ticket-product" })

    return new WorkflowResponse({ ticket_product: created[0] })
  }
)
