import { getProductsById } from "@lib/data/products"
import { getTicketProductAvailability } from "@lib/data/tickets"
import { HttpTypes } from "@medusajs/types"
import ProductActions from "@modules/products/components/product-actions"
import SeatSelector from "@modules/products/components/seat-selector"
import { Text } from "@medusajs/ui"

/**
 * Fetches real time pricing for a product and renders the product actions component.
 */
export default async function ProductActionsWrapper({
  id,
  region,
}: {
  id: string
  region: HttpTypes.StoreRegion
}) {
  const [product] = await getProductsById({
    ids: [id],
    regionId: region.id,
  })

  if (!product) {
    return null
  }

  // A show is bought by seat, not by variant, so it replaces the standard
  // actions entirely. Any other product returns no availability here and
  // falls through to the normal flow.
  const ticketAvailability = await getTicketProductAvailability(id)

  if (ticketAvailability?.availability?.length) {
    const { venue } = ticketAvailability.ticket_product

    return (
      <div className="flex flex-col gap-y-4" data-testid="ticket-actions">
        {venue?.name && (
          <div className="flex flex-col">
            <Text className="text-ui-fg-base font-medium">{venue.name}</Text>
            {venue.address && (
              <Text className="text-ui-fg-subtle text-small-regular">
                {venue.address}
              </Text>
            )}
          </div>
        )}

        <SeatSelector
          productId={id}
          availability={ticketAvailability.availability}
        />
      </div>
    )
  }

  return <ProductActions product={product} region={region} />
}
