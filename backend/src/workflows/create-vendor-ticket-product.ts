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
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import { PricingTypes } from "@medusajs/framework/types"
import { TICKET_BOOKING_MODULE } from "../modules/ticket-booking"
import { MARKETPLACE_MODULE } from "../modules/marketplace"
import { RowType } from "../modules/ticket-booking/models/venue-row"
import { validateVenueAvailabilityStep } from "./steps/validate-venue-availability"
import { createTicketProductsStep } from "./steps/create-ticket-products"
import { createTicketProductVariantsStep } from "./steps/create-ticket-product-variants"
import { DATE_OPTION, ROW_TYPE_OPTION } from "./create-ticket-product"

export type CreateVendorTicketProductWorkflowInput = {
  vendor_id?: string
  vendor_admin_id?: string
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

const toSku = (parts: (string | number)[]) =>
  parts.join("-").replace(/[^a-zA-Z0-9-]+/g, "-").toUpperCase()

export const createVendorTicketProductWorkflow = createWorkflow(
  "create-vendor-ticket-product",
  (input: CreateVendorTicketProductWorkflowInput) => {
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

    const { data: stores } = useQueryGraphStep({
      entity: "store",
      fields: ["default_sales_channel_id"],
    }).config({ name: "retrieve-stores" })

    const { data: stockLocations } = useQueryGraphStep({
      entity: "stock_location",
      fields: ["id"],
    }).config({ name: "retrieve-stock-locations" })

    const { data: shippingProfiles } = useQueryGraphStep({
      entity: "shipping_profile",
      fields: ["id", "type"],
    }).config({ name: "retrieve-shipping-profiles" })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins" })

    // One inventory item per (date, row type)
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
      { input, inventoryItems, stores, shippingProfiles },
      (data) => {
        const defaultProfile =
          data.shippingProfiles?.find((sp: any) => sp.type === "default") ||
          data.shippingProfiles?.[0]

        const defaultSalesChannelId = data.stores[0]?.default_sales_channel_id

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
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: defaultProfile?.id,
            sales_channels: defaultSalesChannelId
              ? [{ id: defaultSalesChannelId }]
              : [],
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

    // Create all links:
    // 1. TicketProduct <-> Product
    // 2. TicketProductVariant <-> ProductVariant
    // 3. Vendor <-> Product
    // 4. Vendor <-> InventoryItems
    const linksToCreate = transform(
      { input, products, ticketProducts, ticketVariants, inventoryItems, vendorAdmins },
      (data) => {
        const vendorId =
          data.input.vendor_id || data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error(
            "Cannot link show: Authenticated vendor profile does not exist."
          )
        }

        const links: any[] = [
          // Link ticket product to product
          {
            [TICKET_BOOKING_MODULE]: {
              ticket_product_id: data.ticketProducts[0].id,
            },
            [Modules.PRODUCT]: {
              product_id: data.products[0].id,
            },
          },
          // Link ticket product variants to product variants
          ...data.ticketVariants.map((ticketVariant) => ({
            [TICKET_BOOKING_MODULE]: {
              ticket_product_variant_id: ticketVariant.id,
            },
            [Modules.PRODUCT]: {
              product_variant_id: ticketVariant.product_variant_id,
            },
          })),
          // Link product to vendor
          {
            [MARKETPLACE_MODULE]: {
              vendor_id: vendorId,
            },
            [Modules.PRODUCT]: {
              product_id: data.products[0].id,
            },
          },
          // Link inventory items to vendor
          ...data.inventoryItems.map((item: any) => ({
            [MARKETPLACE_MODULE]: {
              vendor_id: vendorId,
            },
            [Modules.INVENTORY]: {
              inventory_item_id: item.id,
            },
          })),
        ]

        return links
      }
    )

    createRemoteLinkStep(linksToCreate)

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
    }).config({ name: "retrieve-created-vendor-ticket-product" })

    return new WorkflowResponse({ ticket_product: created[0] })
  }
)
