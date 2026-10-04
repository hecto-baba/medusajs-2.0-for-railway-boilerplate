"use client"

import { useState } from "react"
import { Button, Heading, Text } from "@medusajs/ui"
import { DocumentText, ChevronDown, CheckCircle, XCircle, ArrowRight } from "@medusajs/icons"
import { convertToLocale } from "@lib/util/money"
import Chip from "@modules/common/components/chip"
import {
  acceptQuote,
  rejectQuote,
  sendCustomerQuoteMessage,
  type QuoteDeliveryAddress,
} from "@lib/data/quotes"
import Input from "@modules/common/components/input"

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
        return "success"
      case "customer_rejected":
      case "merchant_rejected":
        return "warning"
      case "pending_customer":
        return "pop"
      default:
        return "muted"
    }
  }

  // A quote with goods to deliver and no delivery address yet asks for one
  // before it is accepted: accepting turns it into an order without passing
  // through checkout, so this is the only point the buyer can be asked.
  const [addressFormFor, setAddressFormFor] = useState<string | null>(null)
  const [address, setAddress] = useState<Record<string, string>>({
    country_code: countryCode,
  })

  const needsDeliveryAddress = (quote: any) =>
    (quote.draft_order?.items ?? []).some(
      (item: any) => item?.requires_shipping !== false
    ) && !quote.draft_order?.shipping_address?.address_1

  const requestAccept = (quote: any) => {
    if (needsDeliveryAddress(quote)) {
      setExpandedId(quote.id)
      setAddressFormFor(quote.id)
      setFeedback(null)
      return
    }
    handleAccept(quote.id)
  }

  const handleAccept = async (
    quoteId: string,
    deliveryAddress?: QuoteDeliveryAddress
  ) => {
    setLoadingId(quoteId)
    setFeedback(null)
    const res = await acceptQuote(quoteId, deliveryAddress)
    if (res.success) {
      setAddressFormFor(null)
      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, status: "accepted" } : q))
      )
      setFeedback({
        type: "success",
        text: "Quote accepted successfully! Your order has been placed.",
      })
    } else {
      // The server decides whether goods need a delivery address, from the
      // order itself. If it asks for one the list did not predict, show the form.
      if (res.error?.includes("delivery address is needed")) {
        setAddressFormFor(quoteId)
      }
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
      <div className="rounded-large p-12 text-center bg-card shadow-lift">
        <div className="flex flex-col items-center justify-center gap-y-2">
          <DocumentText className="text-muted w-8 h-8" />
          <Text weight="plus" className="text-base">
            No Quotes Requested
          </Text>
          <Text size="small" className="text-muted">
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
          className={`p-4 rounded-[12px] border text-sm flex items-center gap-x-2 ${
            feedback.type === "success"
              ? "bg-success-soft border-success text-success"
              : "bg-brand-soft border-brand text-brand"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-brand flex-shrink-0" />
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

        const money = (amount: number) =>
          convertToLocale({ amount, currency_code: currency })

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
            className="rounded-large bg-card overflow-hidden shadow-lift transition-all"
          >
            {/* Header Summary */}
            <div className="p-4 small:p-6 flex flex-col small:flex-row small:items-center justify-between gap-4">
              <div className="flex items-start small:items-center gap-x-4">
                <div className="p-3 bg-canvas rounded-rounded hidden small:block">
                  <DocumentText className="text-muted" />
                </div>
                <div>
                  <div className="flex items-center gap-x-3">
                    <span className="font-mono text-sm font-semibold">
                      {quote.id.replace("quote_", "#")}
                    </span>
                    <Chip tone={getStatusColor(quote.status) as "success" | "warning" | "pop" | "muted"}>
                      {StatusTitles[quote.status] || quote.status}
                    </Chip>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    Requested on {date} &bull; {items.length} item{items.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between small:justify-end gap-x-4">
                <div className="text-right flex flex-col items-end gap-y-1">
                  <div className="text-xs text-muted">Quoted Total</div>
                  <div className="font-semibold text-base font-mono">
                    {Number(total).toFixed(2)} {currency}
                  </div>
                  {quote.metadata?.admin_shipping_price !== undefined && quote.metadata?.admin_shipping_price !== null && (
                    Number(quote.metadata.admin_shipping_price) === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success-soft px-2 py-0.5 rounded-full border border-success">
                        Free Delivery Included ({money(0)})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand bg-brand-soft px-2 py-0.5 rounded-full border border-brand">
                        Delivery Fee: {money(Number(quote.metadata.admin_shipping_price))}
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
                        onClick={() => requestAccept(quote)}
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
                              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-ink bg-brand hover:opacity-90 px-3 py-1.5 rounded-large transition-colors"
                            >
                              Pay & View Order
                              <ArrowRight className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success bg-success-soft px-2.5 py-1 rounded-rounded border border-success">
                              Paid
                            </span>
                          )}

                          <a
                            href={`/${countryCode}/order/confirmed/${quote.draft_order_id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink bg-canvas hover:bg-canvas px-2.5 py-1 rounded-rounded border border-line transition-colors"
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
                    className="p-2 text-muted hover:text-ink rounded-rounded hover:bg-canvas transition-colors"
                    title={isExpanded ? "Collapse details" : "View items"}
                  >
                    <ChevronDown className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* End-to-End B2B Order Progress Bar */}
            {quote.status === "accepted" && (
              <div className="px-4 small:px-6 py-3.5 bg-canvas border-t border-line flex flex-col gap-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Step 1: Order Placed */}
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-success text-success-ink flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                    <div>
                      <span className="font-semibold text-success">1. Quote Accepted</span>
                      <span className="text-success block text-[11px] font-mono">
                        #{quote.draft_order?.display_id || (quote.draft_order_id ? quote.draft_order_id.replace("order_", "") : "LIVE")}
                      </span>
                    </div>
                  </div>

                  {/* Step 2: Payment */}
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      quote.metadata?.payment_status === "paid" || quote.draft_order?.payment_status === "captured" || quote.draft_order?.payment_status === "paid"
                        ? "bg-success text-success-ink"
                        : "bg-pop text-pop-ink border border-pop"
                    }`}>
                      {quote.metadata?.payment_status === "paid" || quote.draft_order?.payment_status === "captured" || quote.draft_order?.payment_status === "paid" ? "✓" : "2"}
                    </span>
                    <div>
                      <span className={`font-semibold ${
                        quote.metadata?.payment_status === "paid" || quote.draft_order?.payment_status === "captured" || quote.draft_order?.payment_status === "paid"
                          ? "text-success"
                          : "text-ink"
                      }`}>
                        2. Payment
                      </span>
                      <span className="text-muted block text-[11px]">
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
                        ? "bg-success text-success-ink"
                        : quote.metadata?.fulfillment_status === "shipped" || quote.draft_order?.fulfillment_status === "shipped"
                        ? "bg-brand text-brand-ink"
                        : "bg-line text-muted"
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
                          ? "text-success"
                          : quote.metadata?.fulfillment_status === "shipped" || quote.draft_order?.fulfillment_status === "shipped"
                          ? "text-brand"
                          : "text-ink"
                      }`}>
                        3. Logistics & Delivery
                      </span>
                      <span className="text-muted block text-[11px]">
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
                  <div className="flex items-center justify-between bg-card/80 px-3 py-1.5 rounded-rounded border border-brand text-brand font-medium">
                    <span>Carrier: <strong>{quote.metadata?.carrier || "Express Freight Delivery"}</strong></span>
                    <span>Tracking #: <strong className="font-mono">{quote.metadata.tracking_number}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Expandable Item Details */}
            {isExpanded && (
              <div className="p-4 small:p-6 bg-canvas border-t border-line">
                <Heading level="h3" className="text-xs font-semibold uppercase text-muted tracking-wider mb-3">
                  Negotiated Line Items
                </Heading>

                {(quote.metadata?.target_price || quote.metadata?.target_shipping_price !== undefined || quote.metadata?.delivery_mode) && (
                  <div className="mb-4 p-3.5 rounded-[12px] bg-brand-soft border border-brand text-xs text-brand flex flex-col gap-y-2">
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
                          <span className="px-2 py-0.5 rounded bg-pop/20 text-ink text-[11px] font-semibold border border-pop">
                            Self-Pickup (Own Vehicle) &bull; {money(0)} Delivery Fee
                          </span>
                        )}
                        {quote.metadata?.delivery_mode === "free_delivery" && (
                          <span className="px-2 py-0.5 rounded bg-success-soft text-success text-[11px] font-semibold border border-success">
                            Requested Free Delivery &bull; {money(0)}
                          </span>
                        )}
                        {quote.metadata?.delivery_mode === "custom_budget" && (
                          <span className="px-2 py-0.5 rounded bg-brand-soft text-brand text-[11px] font-semibold border border-brand">
                            Target Delivery Budget: {money(Number(quote.metadata.target_shipping_price || 0))}
                          </span>
                        )}
                      </div>
                      <span className="text-brand">
                        Original Cart Total: {money(Number(total))}
                      </span>
                    </div>

                    {quote.metadata?.vehicle_note && (
                      <div className="text-[11px] text-ink bg-pop/20 p-2 rounded border border-pop">
                        <strong>Vehicle / Pickup Instructions:</strong> {quote.metadata.vehicle_note}
                      </div>
                    )}

                    {quote.metadata?.admin_shipping_price !== undefined && quote.metadata?.admin_shipping_price !== null && (
                      <div className="text-xs font-medium text-brand bg-brand-soft p-3 rounded-[12px] border border-brand flex flex-col small:flex-row items-start small:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">Merchant Delivery Terms:</span>
                          {Number(quote.metadata.admin_shipping_price) === 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-success bg-success-soft px-2.5 py-0.5 rounded-rounded border border-success">
                              Free Delivery Included ({money(0)})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-brand bg-brand-soft px-2.5 py-0.5 rounded-rounded border border-brand">
                              Delivery Fee: {money(Number(quote.metadata.admin_shipping_price))}
                            </span>
                          )}
                        </div>
                        <div className="text-right text-xs">
                          Final Total: <strong className="font-mono text-sm">{money(Number(total))}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="divide-y divide-line border rounded-rounded bg-card overflow-hidden mb-4">
                  {items.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted">
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
                          className="p-3 small:p-4 flex items-center justify-between text-sm"
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="font-medium text-ink truncate">
                              {item.title}
                            </div>
                            {item.variant_title && (
                              <div className="text-xs text-muted">
                                Variant: {item.variant_title}
                              </div>
                            )}
                          </div>
                          <div className="text-center font-mono text-muted w-16">
                            &times; {item.quantity}
                          </div>
                          <div className="text-right font-mono font-medium text-ink w-24">
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
                    <Heading level="h3" className="text-xs font-semibold uppercase text-muted tracking-wider">
                      Negotiation Notes & Messages
                    </Heading>
                    <div className="space-y-2">
                      {quote.metadata.messages.map((msg: any) => {
                        const isMerchant = msg.sender === "merchant"
                        return (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-[12px] border text-xs ${
                              isMerchant
                                ? "bg-brand-soft border-brand text-brand"
                                : "bg-card border-line text-ink"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold mb-1 text-[11px]">
                              <span>{isMerchant ? "Merchant Note / Offer Terms" : "Your Request Note"}</span>
                              <span className="text-muted font-normal">
                                {msg.created_at
                                  ? new Date(msg.created_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : ""}
                              </span>
                            </div>
                            {msg.item_title && (
                              <div className="text-[10px] text-brand mb-0.5">
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
                    <div className="mb-4 p-3.5 bg-card border border-line rounded-[12px] shadow-lift">
                      <div className="text-xs font-semibold text-ink mb-1.5 flex items-center justify-between">
                        <span>Reply / Negotiate Further</span>
                        <span className="text-[11px] text-muted font-normal">
                          Send counter-proposals or questions to merchant
                        </span>
                      </div>
                      <div className="flex gap-x-2">
                        <input
                          type="text"
                          placeholder="e.g. Can you offer a lower price with free delivery?"
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
                          className="flex-1 text-xs border border-line rounded-rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand"
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
                  <div className="flex items-center justify-between bg-brand-soft border border-brand rounded-rounded p-3 text-xs text-brand">
                    <span>
                      The merchant has reviewed and sent a custom offer for this order. Accepting it converts your quote into an active confirmed order.
                    </span>
                    <Button
                      size="small"
                      className="ml-4 flex-shrink-0"
                      onClick={() => requestAccept(quote)}
                      disabled={isProcessing}
                      isLoading={isProcessing}
                    >
                      Accept Offer Now
                    </Button>
                  </div>
                )}

                {isActionable && addressFormFor === quote.id && (
                  <form
                    className="flex flex-col gap-y-3 rounded-rounded border border-line p-4"
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleAccept(quote.id, address as QuoteDeliveryAddress)
                    }}
                    data-testid="quote-delivery-address-form"
                  >
                    <Text className="txt-medium-plus text-ui-fg-base">
                      Where should we deliver this order?
                    </Text>
                    <div className="grid grid-cols-2 gap-3">
                      {(
                        [
                          ["first_name", "First name", true],
                          ["last_name", "Last name", false],
                          ["address_1", "Address", true],
                          ["address_2", "Apartment, suite, etc.", false],
                          ["postal_code", "Postal code", true],
                          ["city", "City", true],
                          ["province", "State / Province", false],
                          ["country_code", "Country code (e.g. de)", true],
                          ["phone", "Phone", false],
                        ] as [string, string, boolean][]
                      ).map(([name, label, required]) => (
                        <Input
                          key={name}
                          label={label}
                          name={name}
                          value={address[name] ?? ""}
                          required={required}
                          onChange={(e) =>
                            setAddress((prev) => ({
                              ...prev,
                              [name]: e.target.value,
                            }))
                          }
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-end gap-x-2">
                      <Button
                        size="small"
                        variant="secondary"
                        type="button"
                        onClick={() => setAddressFormFor(null)}
                        disabled={isProcessing}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        type="submit"
                        isLoading={isProcessing}
                        disabled={isProcessing}
                      >
                        Confirm and accept
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
