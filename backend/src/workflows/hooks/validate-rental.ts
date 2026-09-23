import { MedusaError } from "@medusajs/framework/utils";
import { completeCartWorkflow } from "@medusajs/medusa/core-flows";
import RentalModuleService from "../../modules/rental/service";
import { RENTAL_MODULE } from "../../modules/rental";
import hasCartOverlap from "../../utils/has-cart-overlap";
import validateRentalDates from "../../utils/validate-rental-dates";
import countRentalDays from "../../utils/count-rental-days";

completeCartWorkflow.hooks.validate(
  async ({ cart }, { container }) => {
    const query = container.resolve("query")
    const rentalModuleService: RentalModuleService = container.resolve(RENTAL_MODULE)

    const { data: [detailedCart] } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "customer_id",
        "items.*",
        "items.variant_id",
        "items.metadata",
        "items.variant.product.rental_configuration.*",
      ],
      filters: { id: cart.id },
    })

    const rentalItems: Record<string, unknown>[] = []

    for (const item of detailedCart.items || []) {
      if (!item || !item.variant) {
        continue
      }

      const rentalConfig = (item.variant as any)?.product?.rental_configuration

      // Only include items that have an active rental configuration
      if (rentalConfig && rentalConfig.status === "active") {
        const metadata = item.metadata || {}

        rentalItems.push({
          line_item_id: item.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          rental_configuration: rentalConfig,
          rental_start_date: metadata.rental_start_date,
          rental_end_date: metadata.rental_end_date,
          rental_days: metadata.rental_days,
        })
      }
    }

    for (let i = 0; i < rentalItems.length; i++) {
      const rentalItem = rentalItems[i]
      const { 
        line_item_id, 
        variant_id, 
        quantity, 
        rental_configuration, 
        rental_start_date, 
        rental_end_date, 
        rental_days
      } = rentalItem

      if ((rental_configuration as any).status !== "active") {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Rental configuration for variant ${variant_id} is not active`
        )
      }

      // Validate quantity is 1 for rental items
      if (quantity !== 1) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Rental items must have a quantity of 1. Line item ${line_item_id} has quantity ${quantity}`
        )
      }

      // Validate metadata presence
      if (!rental_start_date || !rental_end_date || !rental_days) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Line item ${line_item_id} is for a rentable product but missing required metadata: rental_start_date, rental_end_date and/or rental_days`
        )
      }

      const startDate = rental_start_date instanceof Date ? rental_start_date : new Date(rental_start_date as string)
      const endDate = rental_end_date instanceof Date ? rental_end_date : new Date(rental_end_date as string)
      // Recomputed here too: this hook also guards the standard line-item
      // route, where nothing has validated the metadata beforehand.
      const derivedRentalDays = countRentalDays(startDate, endDate)
      
      validateRentalDates(
        startDate, 
        endDate, 
        {
          min_rental_days: (rental_configuration as any).min_rental_days,
          max_rental_days: (rental_configuration as any).max_rental_days,
        }, 
        derivedRentalDays
      )

      const hasCartOverlapResult = hasCartOverlap(
        {
          variant_id: variant_id as string,
          rental_start_date: rental_start_date as Date,
          rental_end_date: rental_end_date as Date,
          rental_days: derivedRentalDays,
        },
        rentalItems.slice(i + 1).map((item) => ({
          id: item.line_item_id as string,
          variant_id: item.variant_id as string,
          metadata: {
            rental_start_date: (item.rental_start_date as Date).toISOString(),
            rental_end_date: (item.rental_end_date as Date).toISOString(),
            rental_days: item.rental_days,
          }
        }))
      )

      if (hasCartOverlapResult) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Cannot have multiple rental items for variant ${variant_id} with overlapping dates in the cart`
        )
      }

      if (await rentalModuleService.hasRentalOverlap(variant_id as string, startDate, endDate)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Variant ${variant_id} is already rented during the requested period (${startDate.toISOString()} to ${endDate.toISOString()})`
        )
      }
    }

    // B2B Employee Spending Limit Check
    try {
      const { data: [cartCustomer] } = await query.graph({
        entity: "cart",
        fields: [
          "id",
          "total",
          "currency_code",
          "customer.employee.id",
          "customer.employee.is_admin",
          "customer.employee.spending_limit",
        ],
        filters: { id: cart.id },
      })

      const employee = (cartCustomer as any)?.customer?.employee
      if (employee && !employee.is_admin && employee.spending_limit) {
        const spendingLimit = Number(employee.spending_limit)
        const cartTotal = Number(cartCustomer.total)
        if (cartTotal > spendingLimit) {
          // Check if cart has already been approved by a manager
          try {
            const { data: approvals } = await query.graph({
              entity: "approval",
              fields: ["id", "cart_id", "statuses.*"],
              filters: { cart_id: cart.id },
            })
            const isApproved = approvals?.some((app: any) =>
              app.statuses?.some((s: any) => s.status === "approved")
            )
            if (isApproved) {
              return
            }
          } catch {}

          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            `Cart total (${cartTotal} ${cartCustomer.currency_code?.toUpperCase()}) exceeds your company spending limit of ${spendingLimit} ${cartCustomer.currency_code?.toUpperCase()}. Please reduce your order or submit it to your manager for approval.`
          )
        }
      }
    } catch (b2bErr) {
      if (b2bErr instanceof MedusaError) {
        throw b2bErr
      }
    }
  }
)