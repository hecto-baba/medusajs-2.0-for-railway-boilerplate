import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { verifyTicketPurchaseWorkflow } from "../../../../../workflows/verify-ticket-purchase"

/**
 * Scans a ticket at the door. The id is whatever the QR code decoded to.
 *
 * Deliberately mounted under /admin rather than at the top level the upstream
 * example uses: a route outside /admin and /store gets no authentication, and
 * this one changes state - anyone able to reach it could burn every ticket in
 * the database. Door staff therefore need an admin session or API key.
 *
 * The QR code still encodes a bare purchase id, so a leaked id is enough to
 * mark that one ticket scanned. Signing the payload is the next hardening step.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  const { result } = await verifyTicketPurchaseWorkflow(req.scope).run({
    input: { ticket_purchase_id: id },
  })

  res.json({
    success: true,
    ticket_purchase: result,
  })
}
