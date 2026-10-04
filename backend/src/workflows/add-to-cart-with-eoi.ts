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
import { QueryContext } from "@medusajs/framework/utils"
import {
  ValidateEoiCartItemInput,
  validateEoiCartItemStep
} from "./steps/validate-eoi-cart-item"

type AddToCartWithEoiWorkflowInput = {
  cart_id: string
  variant_id: string
  quantity: number
  metadata?: Record<string, unknown>
}

/**
 * Mirrors add-to-cart-with-rental.ts structurally. Unlike rental, no second
 * line item is added: rental's deposit is refundable and thus tracked
 * separately, while EOI's remaining balance is not collected in v1, so it
 * lives only as metadata + the Eoi.remaining_amount column, not a
 * chargeable cart entry.
 */
export const addToCartWithEoiWorkflow = createWorkflow(
  "add-to-cart-with-eoi",
  (input: AddToCartWithEoiWorkflowInput) => {
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: [
        "id",
        "currency_code",
        "region_id",
        "items.variant_id",
        "items.metadata",
      ],
      filters: { id: input.cart_id },
      options: {
        throwIfKeyNotFound: true,
      },
    }).config({ name: "retrieve-cart" })

    const { data: variants } = useQueryGraphStep({
      entity: "product_variant",
      fields: [
        "id",
        "eoi_configuration.*",
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

    const eoiData = when({ variants }, (data) => {
      return data.variants[0].eoi_configuration?.status === "active"
    }).then(() => {
      return validateEoiCartItemStep({
        variant: variants[0],
        quantity: input.quantity,
        eoi_configuration: variants[0].eoi_configuration || null,
        cart_items: carts[0].items || [],
      } as unknown as ValidateEoiCartItemInput)
    })

    acquireLockStep({
      key: input.cart_id,
      timeout: 2,
      ttl: 10,
    })

    const itemToAdd = transform({
      input,
      eoiData,
    }, (data) => {
      // The EOI snapshot keys are server-owned: create-eoi-for-order trusts
      // them when it writes the Eoi row, so a client must never be able to
      // supply its own. Strip them from whatever metadata came in.
      const clientMetadata = Object.fromEntries(
        Object.entries(data.input.metadata || {}).filter(
          ([key]) => key !== "is_eoi" && !key.startsWith("eoi_")
        )
      )

      const baseItem = {
        variant_id: data.input.variant_id,
        quantity: data.input.quantity,
        metadata: Object.keys(clientMetadata).length ? clientMetadata : undefined,
      }

      // If it's an EOI-eligible product, use the resolved EOI charge as the
      // line's unit_price and stamp a snapshot into metadata so
      // create-eoi-for-order can persist exactly what was quoted and
      // charged, regardless of what the product's configuration says by
      // checkout - same reasoning add-to-cart-with-rental.ts gives for its
      // own metadata stamp.
      if (data.eoiData?.is_eoi) {
        return [{
          ...baseItem,
          unit_price: data.eoiData.eoi_charged_amount,
          metadata: {
            ...clientMetadata,
            is_eoi: true,
            eoi_value_type: data.eoiData.value_type,
            eoi_value_amount: data.eoiData.value_amount,
            eoi_quoted_unit_price: data.eoiData.quoted_unit_price,
            eoi_charged_amount: data.eoiData.eoi_charged_amount,
            eoi_remaining_amount: data.eoiData.remaining_amount,
          },
        }]
      }

      // For non-EOI products, don't specify unit_price (let Medusa calculate it)
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
      fields: ["id", "currency_code", "items.id", "items.variant_id", "items.unit_price", "items.metadata"],
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
