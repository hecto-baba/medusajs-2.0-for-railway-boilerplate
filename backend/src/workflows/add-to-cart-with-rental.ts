import { 
  createWorkflow, 
  WorkflowResponse, 
  transform,
  when 
} from "@medusajs/framework/workflows-sdk"
import { 
  acquireLockStep, 
  addToCartWorkflow, 
  releaseLockStep, 
  useQueryGraphStep
} from "@medusajs/medusa/core-flows"
import { QueryContext, generateEntityId } from "@medusajs/framework/utils"
import { 
  ValidateRentalCartItemInput, 
  validateRentalCartItemStep
} from "./steps/validate-rental-cart-item"

type AddToCartWorkflowInput = {
  cart_id: string
  variant_id: string
  quantity: number
  metadata?: Record<string, unknown>
}

export const addToCartWithRentalWorkflow = createWorkflow(
  "add-to-cart-with-rental",
  (input: AddToCartWorkflowInput) => {
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: ["id", "currency_code", "region_id", "items.*"],
      filters: { id: input.cart_id },
      options: {
        throwIfKeyNotFound: true,
      },
    }).config({ name: "retrieve-cart" })

    const { data: variants } = useQueryGraphStep({
      entity: "product_variant",
      fields: [
        "id",
        "product.id",
        "product.rental_configuration.*",
        "calculated_price.*",
      ],
      filters: {
        id: input.variant_id,
      },
      options: {
        throwIfKeyNotFound: true,
      },
      context: {
        calculated_price: QueryContext({
          currency_code: carts[0].currency_code,
          region_id: carts[0].region_id,
        }),
      },
    }).config({ name: "retrieve-variant" })

    const rentalData = when({ variants }, (data) => {
      return data.variants[0].product?.rental_configuration?.status === "active"
    }).then(() => {
      return validateRentalCartItemStep({
        variant: variants[0],
        quantity: input.quantity,
        metadata: input.metadata,
        rental_configuration: variants[0].product?.rental_configuration || null,
        existing_cart_items: carts[0].items,
      } as unknown as ValidateRentalCartItemInput)
    })

    acquireLockStep({
      key: input.cart_id,
      timeout: 2,
      ttl: 10,
    })

    const itemToAdd = transform({
      input,
      rentalData,
      variants,
    }, (data) => {
      const baseItem = {
        variant_id: data.input.variant_id,
        quantity: data.input.quantity,
        metadata: data.input.metadata,
      }

      // If it's a rental product, use the calculated rental price and
      // stamp the quote (unit, quantity, deposit) into metadata so
      // create-rentals-for-order can persist exactly what was charged,
      // regardless of what the product's configuration says by checkout.
      if (data.rentalData?.is_rental && data.rentalData.price) {
        // Correlates the rental item with its deposit item below: neither
        // has a cart line item id yet (both are created by the same
        // addToCartWorkflow call), so cart-side cleanup (e.g. removing the
        // deposit when the rental item is removed) matches on this instead.
        // generateEntityId (not Date.now()) so two adds of the same variant
        // within the same millisecond - a double-click, a retried request,
        // two open tabs - can never collide onto the same group id.
        const rentalGroupId = generateEntityId(undefined, "rentgrp")

        const items: Record<string, unknown>[] = [{
          ...baseItem,
          unit_price: data.rentalData.price,
          metadata: {
            ...(data.input.metadata || {}),
            rental_unit: data.rentalData.rental_unit,
            rental_units_count: data.rentalData.rental_units_count,
            rental_deposit_amount: data.rentalData.deposit_amount,
            rental_group_id: rentalGroupId,
          },
        }]

        // Deposit is charged as its own line item rather than folded into
        // unit_price above, so it can be tracked and refunded independently
        // of the rental fee itself. No variant/product is attached - core
        // Medusa's addToCartWorkflow supports a manual, catalog-less line
        // item as long as title/quantity/unit_price are supplied directly.
        if (data.rentalData.deposit_amount > 0) {
          items.push({
            title: "Security Deposit",
            quantity: 1,
            unit_price: data.rentalData.deposit_amount,
            metadata: {
              is_rental_deposit: true,
              rental_group_id: rentalGroupId,
            },
          })
        }

        return items
      }

      // For non-rental products, don't specify unit_price (let Medusa calculate it)
      return [baseItem]
    })

    addToCartWorkflow.runAsStep({
      input: {
        cart_id: input.cart_id,
        items: itemToAdd as any,
      },
    })

    const { data: updatedCart } = useQueryGraphStep({
      entity: "cart",
      fields: ["*", "items.*"],
      filters: {
        id: input.cart_id,
      },
    }).config({ name: "refetch-cart" })

    releaseLockStep({
      key: input.cart_id,
    })

    return new WorkflowResponse({
      cart: updatedCart[0],
    })
  }
)

