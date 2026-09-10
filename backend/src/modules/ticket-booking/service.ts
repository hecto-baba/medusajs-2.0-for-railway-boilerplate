import { MedusaService, promiseAll } from "@medusajs/framework/utils"
import QRCode from "qrcode"
import { Venue } from "./models/venue"
import { VenueRow } from "./models/venue-row"
import { TicketProduct } from "./models/ticket-product"
import { TicketProductVariant } from "./models/ticket-product-variant"
import { TicketPurchase } from "./models/ticket-purchase"

class TicketBookingModuleService extends MedusaService({
  Venue,
  VenueRow,
  TicketProduct,
  TicketProductVariant,
  TicketPurchase,
}) {
  /**
   * Renders a QR code per ticket purchase, keyed by purchase id.
   *
   * The code encodes the purchase id and nothing else, which is what the
   * verification route expects to receive back. Note that this makes the
   * code a bearer token in the weakest sense: anyone holding the id can
   * present it. Signing the payload is tracked as a follow-up.
   */
  async generateTicketQRCodes(
    ticketPurchaseIds: string[]
  ): Promise<Record<string, string>> {
    if (!ticketPurchaseIds.length) {
      return {}
    }

    const ticketPurchases = await this.listTicketPurchases({
      id: ticketPurchaseIds,
    })

    const qrCodeData: Record<string, string> = {}

    await promiseAll(
      ticketPurchases.map(async (ticketPurchase) => {
        qrCodeData[ticketPurchase.id] = await QRCode.toDataURL(
          ticketPurchase.id
        )
      })
    )

    return qrCodeData
  }

  /**
   * Seat numbers a row has already sold for a given show date. Used by the
   * storefront seat map and by validation before a seat enters a cart.
   */
  async listTakenSeatNumbers(
    ticketProductId: string,
    showDate: Date
  ): Promise<string[]> {
    const purchases = await this.listTicketPurchases({
      ticket_product_id: ticketProductId,
      show_date: showDate,
    })

    return purchases.map((purchase) => purchase.seat_number)
  }
}

export default TicketBookingModuleService
