import { addShippingMethodToCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getCartShippingProfileIds } from "../../lib/cart-shipping"

/**
 * A shipping method must ship something in the cart: its option's shipping
 * profile has to be the profile of at least one cart item. Medusa does not
 * check this, so a buyer could attach another seller's option to their cart.
 * (Phase 2, step 3.)
 */
addShippingMethodToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const optionIds = (input.options ?? []).map((option) => option.id)

  if (!optionIds.length) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "shipping_profile_id"],
    filters: { id: optionIds },
  })

  const cartProfiles = new Set(await getCartShippingProfileIds(container, input.cart_id))

  for (const option of (options ?? []) as any[]) {
    if (!cartProfiles.has(option.shipping_profile_id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Shipping Options are invalid for cart."
      )
    }
  }
})
