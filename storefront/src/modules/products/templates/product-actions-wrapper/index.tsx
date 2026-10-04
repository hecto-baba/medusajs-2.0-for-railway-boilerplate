import { getProductAppointmentOffer } from "@lib/data/appointments"
import { getTicketProductAvailability } from "@lib/data/tickets"
import { HttpTypes } from "@medusajs/types"
import BookingPanel from "@modules/appointments/components/booking-panel"
import ProductActions from "@modules/products/components/product-actions"
import EnquiryForm, { EnquiryField } from "@modules/products/components/enquiry-form"
import SeatSelector from "@modules/products/components/seat-selector"
import { Text } from "@medusajs/ui"

/**
 * Fetches real time pricing for a product and renders the product actions component.
 */
export default async function ProductActionsWrapper({
  product,
  region,
}: {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
}) {
  const id = product.id
  // The product (with enquiry/EOI config) is already loaded by the page, so
  // only the two probes remain; both are cached (including the "not a show /
  // not an appointment" answer) and run together. A failed lookup resolves to
  // null and the page falls through to the normal flow.
  const [ticketAvailability, appointmentOffer] = await Promise.all([
    getTicketProductAvailability(id),
    getProductAppointmentOffer(id, region.id),
  ])

  // A show is bought by seat, not by variant, so it replaces the standard
  // actions entirely. Any other product returns no availability here and
  // falls through to the normal flow.

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

  // An appointment is booked (who, day, time), not added to the cart as an item,
  // so a bookable product replaces the standard actions. Anything else - including
  // a service nobody can currently be booked for - keeps the normal flow.
  if (appointmentOffer?.bookable && appointmentOffer.resources.length) {
    return <BookingPanel offer={appointmentOffer} />
  }

  // A service nobody can be booked for right now must not become a plain
  // "Add to cart": it would be bought with no person and no time.
  if (appointmentOffer?.is_appointment) {
    return (
      <div
        className="border-ui-border-base rounded-xl border p-5"
        data-testid="appointment-unavailable"
      >
        <Text className="text-ui-fg-base font-medium">Not taking bookings right now</Text>
        <Text className="text-ui-fg-subtle text-small-regular mt-1">
          There are no times available for this service at the moment. Please check back soon.
        </Text>
      </div>
    )
  }

  // A product with enquiries on is enquiry-only: the backend refuses it in a
  // cart, so show the question form instead of Add to Cart. (Placed after the
  // ticket and appointment branches; a product uses only one sale mode.)
  const enquiryConfig = (product as any).enquiry_configuration as
    | { status?: string; custom_fields?: EnquiryField[] | null }
    | null
    | undefined

  if (enquiryConfig?.status === "active") {
    return (
      <EnquiryForm
        productId={product.id}
        productTitle={product.title}
        fields={enquiryConfig.custom_fields ?? []}
      />
    )
  }

  return <ProductActions product={product} region={region} />
}
