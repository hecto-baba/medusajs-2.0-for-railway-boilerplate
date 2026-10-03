import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { deleteLineItemsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * A deposit line item added by add-to-cart-with-rental has no product/variant
 * of its own - it exists only to be paired with a rental line item via a
 * shared rental_group_id. If that rental item is ever removed from the cart
 * (via the standard delete-line-item route, an admin edit, or anything else
 * that fires cart.updated) while its deposit line item is left behind, the
 * shopper would be left paying a deposit for a rental that no longer exists.
 *
 * Reconciling here - after every cart update, rather than hooking the one
 * delete route - self-heals regardless of which code path removed the
 * rental item, and is naturally idempotent: a cart with no orphaned deposit
 * lines does nothing.
 *
 * Known cost: cart.updated fires on every cart mutation (address, email,
 * promo code, shipping method - not just line-item changes), and Medusa does
 * not expose a narrower "line item removed" event in this version, so this
 * runs a small query.graph fetch (id + metadata only, no joins) on every one
 * of those, even though only a rental-item removal can ever produce an
 * orphan. Acceptable for now; if cart-mutation volume on a rental-heavy store
 * makes this measurable, the fix is a narrower trigger, not more work per
 * invocation.
 */
export default async function rentalDepositCleanupHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const query = container.resolve("query")

  const { data: [cart] } = await query.graph({
    entity: "cart",
    fields: ["id", "items.id", "items.metadata"],
    filters: { id: data.id },
  })

  if (!cart?.items?.length) {
    return
  }

  const activeGroupIds = new Set(
    cart.items
      .filter((item) => item?.metadata?.rental_unit && !item.metadata?.is_rental_deposit)
      .map((item) => item!.metadata!.rental_group_id as string | undefined)
      .filter((groupId): groupId is string => !!groupId)
  )

  const orphanedDepositIds = cart.items
    .filter((item) => {
      if (!item?.metadata?.is_rental_deposit) {
        return false
      }
      const groupId = item.metadata.rental_group_id as string | undefined
      return !groupId || !activeGroupIds.has(groupId)
    })
    .map((item) => item!.id)

  if (orphanedDepositIds.length === 0) {
    return
  }

  try {
    await deleteLineItemsWorkflow(container).run({
      input: {
        cart_id: cart.id,
        ids: orphanedDepositIds,
      },
    })
    logger.info(
      `Removed ${orphanedDepositIds.length} orphaned rental deposit line item(s) from cart ${cart.id}`
    )
  } catch (error) {
    logger.error(
      `Failed to remove orphaned rental deposit line item(s) from cart ${cart.id}: ${error.message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "cart.updated",
}
