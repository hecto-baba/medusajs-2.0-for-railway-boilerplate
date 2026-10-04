"use server"

import { sdk } from "@lib/config"
import { headers } from "next/headers"
import { getAuthHeaders } from "./cookies"

export type SubmitEnquiryResult = { ok: true } | { ok: false; error: string }

/**
 * Sends a product enquiry. Runs on the server so a logged-in customer's token
 * (kept in an httpOnly cookie) goes with the request and the enquiry is linked
 * to their account; a guest simply sends none.
 *
 * The buyer's IP is forwarded because the backend rate-limits per client
 * address. Without it every buyer would arrive from this server's address and
 * share one limit.
 */
export async function submitEnquiry(input: {
  product_id: string
  customer_email: string
  message: string
  custom_field_answers?: Record<string, string | string[]>
}): Promise<SubmitEnquiryResult> {
  const incoming = await headers()
  const forwardedFor = incoming.get("x-forwarded-for")

  try {
    await sdk.client.fetch("/store/enquiries", {
      method: "POST",
      body: input,
      headers: {
        ...(await getAuthHeaders()),
        ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      },
      cache: "no-store",
    })
    return { ok: true }
  } catch (error: any) {
    // The backend's messages are written for the shopper ("Phone must be in
    // E.164 format...", "This product is not currently accepting enquiries.").
    return {
      ok: false,
      error: error?.message || "Could not send your enquiry. Please try again.",
    }
  }
}
