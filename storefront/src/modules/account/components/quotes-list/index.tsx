"use client"

import { useState } from "react"
import { Badge, Button, Heading, Text } from "@medusajs/ui"
import { DocumentText, ChevronDown, CheckCircle, XCircle, ArrowRight } from "@medusajs/icons"
import { acceptQuote, rejectQuote, sendCustomerQuoteMessage } from "@lib/data/quotes"

const StatusTitles: Record<string, string> = {
  accepted: "Accepted",
  customer_rejected: "You Declined",
  merchant_rejected: "Merchant Rejected",
  pending_merchant: "Pending Merchant Review",
  pending_customer: "Action Required: Review Offer",
}

type QuotesListProps = {
  initialQuotes: any[]
  countryCode: string
}

export const QuotesList = ({ initialQuotes, countryCode }: QuotesListProps) => {
  const [quotes, setQuotes] = useState(initialQuotes)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [replyLoadingId, setReplyLoadingId] = useState<string | null>(null)


  const handleSendReply = async (quoteId: string) => {
    const text = replyTexts[quoteId]?.trim()
    if (!text) return
    setReplyLoadingId(quoteId)
    const res = await sendCustomerQuoteMessage(quoteId, text)
    if (res.success) {
      setQuotes((prev) =>
        prev.map((q) => {
          if (q.id !== quoteId) return q
          const msgs = q.metadata?.messages || []
          return {
            ...q,
            metadata: {
              ...q.metadata,
              messages: [
                ...msgs,
                {
                  id: `msg_${Date.now()}`,
                  sender: "customer",
                  text,
                  created_at: new Date().toISOString(),
                },
              ],
            },
          }
        })
      )
      setReplyTexts((prev) => ({ ...prev, [quoteId]: "" }))
      setFeedback({
        type: "success",
        text: "Counter-offer message sent to the merchant!",
      })
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Failed to send message.",
      })
    }
    setReplyLoadingId(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "green"
      case "customer_rejected":
      case "merchant_rejected":
        return "red"
      case "pending_customer":
        return "blue"
      default:
        return "orange"
    }
  }

  const handleAccept = async (quoteId: string) => {
    setLoadingId(quoteId)
    setFeedback(null)
    const res = await acceptQuote(quoteId)
    if (res.success) {
      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, status: "accepted" } : q))
      )
      setFeedback({
        type: "success",
        text: "Quote accepted successfully! Your order has been placed.",
      })
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Failed to accept quote. Please try again.",
      })
    }
    setLoadingId(null)
  }

  const handleReject = async (quoteId: string) => {
    setLoadingId(quoteId)
    setFeedback(null)
    const res = await rejectQuote(quoteId)
    if (res.success) {
      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, status: "customer_rejected" } : q))
      )
      setFeedback({
        type: "success",
        text: "Quote offer declined.",
      })
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Failed to decline quote.",
      })
    }
    setLoadingId(null)
  }


  if (quotes.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-12 text-center bg-gray-50">
        <div className="flex flex-col items-center justify-center gap-y-2">
          <DocumentText className="text-ui-fg-muted w-8 h-8" />
          <Text weight="plus" className="text-base">
            No Quotes Requested
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            You haven&apos;t requested any custom wholesale price negotiations yet.
          </Text>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-4">
      {feedback && (
        <div
          className={`p-4 rounded-lg border text-sm flex items-center gap-x-2 ${
            feedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {quotes.map((quote) => {
        const currency = (
          quote.draft_order?.currency_code ||
          quote.cart?.currency_code ||
          "eur"
        ).toUpperCase()

        const total =
          quote.draft_order?.total ??
          quote.cart?.total ??
          0
        const items =
          quote.draft_order?.items ||
          quote.cart?.items ||
          []
        const date = quote.created_at
          ? new Date(quote.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "-"

        const isExpanded = expandedId === quote.id
        const isActionable = quote.status === "pending_customer"
        const isProcessing = loadingId === quote.id

        return (
          <div
            key={quote.id}
            className="border rounded-lg bg-white overflow-hidden shadow-sm transition-all"
          >
            {/* Header Summary */}
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-x-4">
                <div className="p-3 bg-ui-bg-subtle rounded-md hidden sm:block">
                  <DocumentText className="text-ui-fg-subtle" />
                </div>
                <div>
                  <div className="flex items-center gap-x-3">
                    <span className="font-mono text-sm font-semibold">
                      {quote.id.replace("quote_", "#")}
                    </span>
                    <Badge color={getStatusColor(quote.status)} size="xsmall">
                      {StatusTitles[quote.status] || quote.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-ui-fg-subtle mt-1">
                    Requested on {date} &bull; {items.length} item{items.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-x-4">
                <div className="text-right flex flex-col items-end gap-y-1">
                  <div className="text-xs text-ui-fg-subtle">Quoted Total</div>
                  <div className="font-semibold text-base font-mono">
                    {Number(total).toFixed(2)} {currency}
                  </div>
                  {quote.metadata?.admin_shipping_price !== undefined && quote.metadata?.admin_shipping_price !== null && (
                    Number(quote.metadata.admin_shipping_price) === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                        🚚 Free Delivery Included (€0.00)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        📦 Delivery Fee: €{Number(quote.metadata.admin_shipping_price).toFixed(2)}
                      </span>
                    )
                  )}
                </div>

                <div className="flex items-center gap-x-2">
                  {isActionable && (
                    <>
                      <Button
                        size="small"
                        variant="danger"
                        onClick={() => handleReject(quote.id)}
                        disabled={isProcessing}
                      >
                        Decline
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleAccept(quote.id)}
                        disabled={isProcessing}
                        isLoading={isProcessing}
                      >
                        Accept Offer
                      </Button>
                    </>
                  )}

                  {quote.status === "accepted" && (
                    <div className="flex items-center gap-x-2">
                      {/* Link to the real Medusa order page — standard payment is handled there */}
                      {quote.draft_order_id && (
                        <>
                          {!(
                            quote.metadata?.payment_status === "paid" ||
                            quote.draft_order?.payment_status === "captured" ||
                            quote.draft_order?.payment_status === "paid"
                          ) ? (
                            <a
                              href={`/${countryCode}/order/confirmed/${quote.draft_order_id}`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-black hover:bg-gray-800 px-3 py-1.5 rounded-md transition-colors"
                            >
                              💳 Pay & View Order
                              <ArrowRight className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                              ✓ Paid
                            </span>
                          )}

                          <a
                            href={`/${countryCode}/order/confirmed/${quote.draft_order_id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-ui-fg-subtle hover:text-ui-fg-base bg-gray-50 hover:bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200 transition-colors"
                          >
                            <span>Track Order</span>
                            <ArrowRight className="w-3 h-3" />
                          </a>
                        </>
                      )}
                    </div>
                  )}


                  <button
                    onClick={() => setExpandedId(isExpanded ? null : quote.id)}
                    className="p-2 text-ui-fg-subtle hover:text-ui-fg-base rounded-md hover:bg-gray-100 transition-colors"
                    title={isExpanded ? "Collapse details" : "View items"}
                  >
                    <ChevronDown className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* End-to-End B2B Order Progress Bar */}
            {quote.status === "accepted" && (
              <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-emerald-50/70 via-blue-50/40 to-gray-50 border-t border-emerald-100 flex flex-col gap-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Step 1: Order Placed */}
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                    <div>
                      <span className="font-semibold text-emerald-950">1. Quote Accepted</span>
                      <span className="text-emerald-700 block text-[11px] font-mono">
                        #{quote.draft_order?.display_id || (quote.draft_order_id ? quote.draft_order_id.replace("order_", "") : "LIVE")}
                      </span>
                    </div>
                  </div>

                  {/* Step 2: Payment */}
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      quote.metadata?.payment_status === "paid" || quote.draft_order?.payment_status === "captured" || quote.draft_order?.payment_status === "paid"
                        ? "bg-emerald-600 text-white"
                        : "bg-amber-100 text-amber-900 border border-amber-300"
                    }`}>
                      {quote.metadata?.payment_status === "paid" || quote.draft_order?.payment_status === "captured" || quote.draft_order?.payment_status === "paid" ? "✓" : "2"}
                    </span>
                    <div>
                      <span className={`font-semibold ${
                        quote.metadata?.payment_status === "paid" || quote.draft_order?.payment_status === "captured" || quote.draft_order?.payment_status === "paid"
                          ? "text-emerald-950"
                          : "text-amber-900"
                      }`}>
                        2. Payment
                      </span>
                      <span className="text-ui-fg-subtle block text-[11px]">
                        {quote.metadata?.payment_status === "paid" || quote.draft_order?.payment_status === "captured" || quote.draft_order?.payment_status === "paid"
                          ? `Captured (${quote.metadata?.payment_method || "Paid"})`
                          : "Awaiting Payment"}
                      </span>
                    </div>
                  </div>

                  {/* Step 3: Dispatch & Delivery */}
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      quote.metadata?.fulfillment_status === "delivered" || quote.draft_order?.fulfillment_status === "delivered"
                        ? "bg-emerald-600 text-white"
                        : quote.metadata?.fulfillment_status === "shipped" || quote.draft_order?.fulfillment_status === "shipped"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}>
                      {quote.metadata?.fulfillment_status === "delivered" || quote.draft_order?.fulfillment_status === "delivered"
                        ? "✓"
                        : quote.metadata?.fulfillment_status === "shipped" || quote.draft_order?.fulfillment_status === "shipped"
                        ? "3"
                        : "3"}
                    </span>
                    <div>
                      <span className={`font-semibold ${
                        quote.metadata?.fulfillment_status === "delivered" || quote.draft_order?.fulfillment_status === "delivered"
                          ? "text-emerald-950"
                          : quote.metadata?.fulfillment_status === "shipped" || quote.draft_order?.fulfillment_status === "shipped"
                          ? "text-blue-950"
                          : "text-gray-700"
                      }`}>
                        3. Logistics & Delivery
                      </span>
                      <span className="text-ui-fg-subtle block text-[11px]">
                        {quote.metadata?.fulfillment_status === "delivered" || quote.draft_order?.fulfillment_status === "delivered"
                          ? "Delivered to Buyer Location"
                          : quote.metadata?.fulfillment_status === "shipped" || quote.draft_order?.fulfillment_status === "shipped"
                          ? `In Transit (${quote.metadata?.carrier || "Express Freight"})`
                          : "Preparing Order"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tracking & Note details */}
                {quote.metadata?.tracking_number && (
                  <div className="flex items-center justify-between bg-white/80 px-3 py-1.5 rounded-md border border-blue-200 text-blue-900 font-medium">
                    <span>📦 Carrier: <strong>{quote.metadata?.carrier || "Express Freight Delivery"}</strong></span>
                    <span>Tracking #: <strong className="font-mono">{quote.metadata.tracking_number}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Expandable Item Details */}
            {isExpanded && (
              <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-100">
                <Heading level="h3" className="text-xs font-semibold uppercase text-ui-fg-muted tracking-wider mb-3">
                  Negotiated Line Items
                </Heading>

                {(quote.metadata?.target_price || quote.metadata?.target_shipping_price !== undefined || quote.metadata?.delivery_mode) && (
                  <div className="mb-4 p-3.5 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex flex-col gap-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {quote.metadata?.target_price && (
                          <span>
                            <strong>Target Products:</strong>{" "}
                            <span className="font-mono text-sm font-semibold">
                              {Number(quote.metadata.target_price).toFixed(2)} {currency}
                            </span>
                          </span>
                        )}
                        {quote.metadata?.delivery_mode === "customer_vehicle_pickup" && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-semibold border border-amber-300">
                            🚗 Self-Pickup (Own Vehicle) &bull; €0.00 Delivery Fee
                          </span>
                        )}
                        {quote.metadata?.delivery_mode === "free_delivery" && (
                          <span className="px-2 py-0.5 rounded bg-green-100 text-green-900 text-[11px] font-semibold border border-green-300">
                            🚚 Requested Free Delivery &bull; €0.00
                          </span>
                        )}
                        {quote.metadata?.delivery_mode === "custom_budget" && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-[11px] font-semibold border border-blue-300">
                            📦 Target Delivery Budget: €{Number(quote.metadata.target_shipping_price || 0).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <span className="text-blue-700">
                        Original Cart Total: €{Number(total).toFixed(2)}
                      </span>
                    </div>

                    {quote.metadata?.vehicle_note && (
                      <div className="text-[11px] text-amber-900 bg-amber-50/70 p-2 rounded border border-amber-200">
                        <strong>Vehicle / Pickup Instructions:</strong> {quote.metadata.vehicle_note}
                      </div>
                    )}

                    {quote.metadata?.admin_shipping_price !== undefined && quote.metadata?.admin_shipping_price !== null && (
                      <div className="text-xs font-medium text-purple-950 bg-purple-50/90 p-3 rounded-lg border border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">Merchant Delivery Terms:</span>
                          {Number(quote.metadata.admin_shipping_price) === 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-green-800 bg-green-100/90 px-2.5 py-0.5 rounded-md border border-green-300">
                              🚚 Free Delivery Included (€0.00)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-blue-800 bg-blue-100/90 px-2.5 py-0.5 rounded-md border border-blue-300">
                              📦 Delivery Fee: €{Number(quote.metadata.admin_shipping_price).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="text-right text-xs">
                          Final Total: <strong className="font-mono text-sm">€{Number(total).toFixed(2)} {currency}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="divide-y divide-gray-200 border rounded-md bg-white overflow-hidden mb-4">
                  {items.length === 0 ? (
                    <div className="p-4 text-center text-sm text-ui-fg-subtle">
                      No line items found.
                    </div>
                  ) : (
                    items.map((item: any) => {
                      const itemTotal =
                        item.total ??
                        Number(item.unit_price || 0) * Number(item.quantity || 1)

                      return (
                        <div
                          key={item.id}
                          className="p-3 sm:p-4 flex items-center justify-between text-sm"
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="font-medium text-ui-fg-base truncate">
                              {item.title}
                            </div>
                            {item.variant_title && (
                              <div className="text-xs text-ui-fg-subtle">
                                Variant: {item.variant_title}
                              </div>
                            )}
                          </div>
                          <div className="text-center font-mono text-ui-fg-subtle w-16">
                            &times; {item.quantity}
                          </div>
                          <div className="text-right font-mono font-medium text-ui-fg-base w-24">
                            {Number(itemTotal).toFixed(2)} {currency}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Messages Thread */}
                {quote.metadata?.messages && quote.metadata.messages.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <Heading level="h3" className="text-xs font-semibold uppercase text-ui-fg-muted tracking-wider">
                      Negotiation Notes & Messages
                    </Heading>
                    <div className="space-y-2">
                      {quote.metadata.messages.map((msg: any) => {
                        const isMerchant = msg.sender === "merchant"
                        return (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-lg border text-xs ${
                              isMerchant
                                ? "bg-purple-50/70 border-purple-200 text-purple-950"
                                : "bg-white border-gray-200 text-gray-800"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold mb-1 text-[11px]">
                              <span>{isMerchant ? "Merchant Note / Offer Terms" : "Your Request Note"}</span>
                              <span className="text-ui-fg-subtle font-normal">
                                {msg.created_at
                                  ? new Date(msg.created_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : ""}
                              </span>
                            </div>
                            {msg.item_title && (
                              <div className="text-[10px] text-ui-fg-interactive mb-0.5">
                                Ref: {msg.item_title}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Counter-Offer Reply Box */}
                {quote.status !== "accepted" &&
                  quote.status !== "customer_rejected" &&
                  quote.status !== "merchant_rejected" && (
                    <div className="mb-4 p-3.5 bg-white border border-gray-200 rounded-lg shadow-sm">
                      <div className="text-xs font-semibold text-ui-fg-base mb-1.5 flex items-center justify-between">
                        <span>Reply / Negotiate Further</span>
                        <span className="text-[11px] text-ui-fg-subtle font-normal">
                          Send counter-proposals or questions to merchant
                        </span>
                      </div>
                      <div className="flex gap-x-2">
                        <input
                          type="text"
                          placeholder="e.g. Can you do €800 instead of €850 with free delivery?"
                          value={replyTexts[quote.id] || ""}
                          onChange={(e) =>
                            setReplyTexts((prev) => ({
                              ...prev,
                              [quote.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleSendReply(quote.id)
                            }
                          }}
                          className="flex-1 text-xs border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-black"
                          disabled={replyLoadingId === quote.id}
                        />
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => handleSendReply(quote.id)}
                          disabled={
                            !replyTexts[quote.id]?.trim() ||
                            replyLoadingId === quote.id
                          }
                          isLoading={replyLoadingId === quote.id}
                        >
                          Send Reply
                        </Button>
                      </div>
                    </div>
                  )}

                {isActionable && (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-800">
                    <span>
                      The merchant has reviewed and sent a custom offer for this order. Accepting it converts your quote into an active confirmed order.
                    </span>
                    <Button
                      size="small"
                      className="ml-4 flex-shrink-0"
                      onClick={() => handleAccept(quote.id)}
                      disabled={isProcessing}
                      isLoading={isProcessing}
                    >
                      Accept Offer Now
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
