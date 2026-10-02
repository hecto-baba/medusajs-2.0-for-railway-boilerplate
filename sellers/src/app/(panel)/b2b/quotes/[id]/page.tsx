"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  DocumentText,
  EllipsisHorizontal,
  PencilSquare,
  Trash,
  XCircle,
} from "@medusajs/icons"
import Link from "next/link"
import {
  getVendorQuote,
  negotiateVendorQuote,
  updateVendorQuoteStatus,
  VendorQuoteItem,
} from "@lib/data/vendor-client"

const StatusTitles: Record<string, string> = {
  accepted: "Accepted",
  customer_rejected: "Customer Rejected",
  merchant_rejected: "Merchant Rejected",
  pending_merchant: "Pending Merchant",
  pending_customer: "Pending Customer",
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  // State for line item price overrides
  const [isEditing, setIsEditing] = useState(false)
  const [editedItems, setEditedItems] = useState<
    Record<string, { quantity: number; unit_price: number }>
  >({})

  const [editedShippingPrice, setEditedShippingPrice] = useState<string>("")

  // State for message composer
  const [selectedItemId, setSelectedItemId] = useState<string>("general")
  const [messageText, setMessageText] = useState("")
  const [showJson, setShowJson] = useState(false)

  // State for Logistics & Delivery actions
  const [carrierInput, setCarrierInput] = useState("Express Freight Delivery")
  const [trackingInput, setTrackingInput] = useState("")
  const [showDispatchForm, setShowDispatchForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-quote", id],
    queryFn: () => getVendorQuote(id),
    enabled: !!id,
  })

  const quote = data?.quote
  const preview = data?.order_preview

  const items =
    preview?.items ||
    quote?.draft_order?.items ||
    quote?.cart?.items ||
    []

  // Sync line item edit state
  useEffect(() => {
    if (items.length > 0 && (!isEditing || Object.keys(editedItems).length === 0)) {
      const initial: Record<string, { quantity: number; unit_price: number }> = {}
      items.forEach((item: any) => {
        const negotiatedItem =
          quote?.metadata?.items_negotiated?.find((ni: any) => ni.id === item.id) ||
          quote?.metadata?.items_negotiated?.[0]

        const defaultUnit =
          negotiatedItem?.unit_price !== undefined
            ? Number(negotiatedItem.unit_price)
            : Number(item.unit_price || 0)

        const defaultQty =
          negotiatedItem?.quantity !== undefined
            ? Number(negotiatedItem.quantity)
            : Number(item.quantity || 1)

        initial[item.id] = {
          quantity: defaultQty,
          unit_price: defaultUnit,
        }
      })
      setEditedItems(initial)
    }

    if (quote?.metadata) {
      const initShipping =
        quote.metadata.admin_shipping_price !== undefined &&
        quote.metadata.admin_shipping_price !== null
          ? String(quote.metadata.admin_shipping_price)
          : quote.metadata.target_shipping_price !== undefined &&
            quote.metadata.target_shipping_price !== null
          ? String(quote.metadata.target_shipping_price)
          : "0.00"
      setEditedShippingPrice(initShipping)

      if (quote.metadata.carrier) {
        setCarrierInput(quote.metadata.carrier)
      }
      if (quote.metadata.tracking_number) {
        setTrackingInput(quote.metadata.tracking_number)
      }
    }
  }, [items, quote])

  // Mutation: Send quote counter-offer to customer
  const { mutateAsync: sendQuote, isPending: isSending } = useMutation({
    mutationFn: () =>
      negotiateVendorQuote(id, {
        status: "pending_customer",
        items_negotiated: items.map((item: any) => {
          const edited = editedItems[item.id]
          return {
            id: item.id,
            title: item.title,
            quantity: edited?.quantity ?? item.quantity,
            unit_price: edited?.unit_price ?? item.unit_price,
          }
        }),
        vendor_shipping_price: parseFloat(editedShippingPrice) || 0,
      }),
    onSuccess: () => {
      toast.success("Quote Sent", {
        description: "The revised quote counter-offer has been sent to the buyer.",
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-quote", id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-quotes"] })
    },
    onError: (err: any) => {
      toast.error("Error", {
        description: err.message || "Failed to send quote",
      })
    },
  })

  // Mutation: Reject quote
  const { mutateAsync: rejectQuote, isPending: isRejecting } = useMutation({
    mutationFn: () =>
      updateVendorQuoteStatus(id, "merchant_rejected"),
    onSuccess: () => {
      toast.success("Quote Rejected", {
        description: "The quote request has been rejected.",
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-quote", id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-quotes"] })
    },
    onError: (err: any) => {
      toast.error("Error", {
        description: err.message || "Failed to reject quote",
      })
    },
  })

  // Mutation: Accept quote directly
  const { mutateAsync: acceptQuote, isPending: isAccepting } = useMutation({
    mutationFn: () =>
      updateVendorQuoteStatus(id, "accepted"),
    onSuccess: () => {
      toast.success("Quote Accepted", {
        description: "Quote has been accepted and order is now confirmed!",
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-quote", id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-quotes"] })
    },
    onError: (err: any) => {
      toast.error("Error", {
        description: err.message || "Failed to accept quote",
      })
    },
  })

  // Mutation: Save item price & quantity overrides + shipping price
  const { mutateAsync: saveItemChanges, isPending: isSavingItems } = useMutation({
    mutationFn: () => {
      const itemsPayload = Object.entries(editedItems).map(([itemId, val]) => ({
        id: itemId,
        title: items.find((i: any) => i.id === itemId)?.title || "Product",
        quantity: Number(val.quantity),
        unit_price: Number(val.unit_price),
      }))
      return negotiateVendorQuote(id, {
        items_negotiated: itemsPayload,
        vendor_shipping_price: parseFloat(editedShippingPrice) || 0,
      })
    },
    onSuccess: () => {
      toast.success("Custom Pricing & Delivery Saved", {
        description: "Line item prices and delivery terms updated on quote.",
      })
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ["vendor-quote", id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-quotes"] })
    },
    onError: (err: any) => {
      toast.error("Error", {
        description: err.message || "Failed to save changes",
      })
    },
  })

  // Mutation: Send message in quote thread
  const { mutateAsync: postMessage, isPending: isPostingMessage } = useMutation({
    mutationFn: () => {
      const selectedItem = items.find((i: any) => i.id === selectedItemId)
      const currentMessages = quote?.metadata?.messages || []
      return negotiateVendorQuote(id, {
        metadata: {
          messages: [
            ...currentMessages,
            {
              id: `msg_${Date.now()}`,
              text: messageText,
              sender: "merchant",
              item_id: selectedItemId === "general" ? null : selectedItemId,
              item_title: selectedItem ? selectedItem.title : null,
              created_at: new Date().toISOString(),
            },
          ],
        },
      } as any)
    },
    onSuccess: () => {
      toast.success("Message Sent", { description: "Your note was added to the quote." })
      setMessageText("")
      queryClient.invalidateQueries({ queryKey: ["vendor-quote", id] })
    },
    onError: (err: any) => {
      toast.error("Message Error", {
        description: err.message || "Failed to send message.",
      })
    },
  })

  // Mutations: B2B Order Lifecycle (Payment, Dispatch, Delivery)
  const recordPaymentMutation = useMutation({
    mutationFn: () =>
      negotiateVendorQuote(id, {
        metadata: {
          payment_status: "paid",
          payment_method: "Recorded by Merchant (Invoice / Wire)",
          paid_at: new Date().toISOString(),
        },
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-quote", id] })
      toast.success("Payment Recorded", {
        description: "Order marked as Paid (Captured).",
      })
    },
    onError: (err: any) => {
      toast.error("Payment Error", {
        description: err.message || "Failed to record payment.",
      })
    },
  })

  const dispatchOrderMutation = useMutation({
    mutationFn: () =>
      negotiateVendorQuote(id, {
        metadata: {
          fulfillment_status: "shipped",
          carrier: carrierInput || "Express Freight Delivery",
          tracking_number: trackingInput || undefined,
          shipped_at: new Date().toISOString(),
        },
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-quote", id] })
      setShowDispatchForm(false)
      toast.success("Order Dispatched", {
        description: "Order is now In Transit to the buyer's destination.",
      })
    },
    onError: (err: any) => {
      toast.error("Dispatch Error", {
        description: err.message || "Failed to dispatch order.",
      })
    },
  })

  const deliverOrderMutation = useMutation({
    mutationFn: () =>
      negotiateVendorQuote(id, {
        metadata: {
          fulfillment_status: "delivered",
          delivered_at: new Date().toISOString(),
        },
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-quote", id] })
      toast.success("Delivery Confirmed", {
        description: "Order has been successfully delivered to the buyer!",
      })
    },
    onError: (err: any) => {
      toast.error("Delivery Error", {
        description: err.message || "Failed to mark as delivered.",
      })
    },
  })

  const resetFulfillmentMutation = useMutation({
    mutationFn: () =>
      negotiateVendorQuote(id, {
        metadata: {
          fulfillment_status: "not_fulfilled",
          carrier: null,
          tracking_number: null,
        },
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-quote", id] })
      setShowDispatchForm(false)
      toast.success("Fulfillment Reset", {
        description: "Status reset to preparing. You can test dispatch and delivery stages again.",
      })
    },
    onError: (err: any) => {
      toast.error("Error", {
        description: err.message || "Failed to reset fulfillment.",
      })
    },
  })

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

  if (isLoading) {
    return (
      <Container className="p-8">
        <Text className="text-ui-fg-subtle">Loading quote details...</Text>
      </Container>
    )
  }

  if (!quote) {
    return (
      <Container className="p-8">
        <Heading level="h2">Quote not found</Heading>
        <Link href="/b2b/quotes">
          <Button
            variant="secondary"
            size="small"
            className="mt-4"
          >
            <ArrowLeft /> Back to Quotes
          </Button>
        </Link>
      </Container>
    )
  }

  // Customer & Company Data
  const customer = quote.customer || ({} as any)
  const employee = customer.employee || {}
  const company = employee.company || {}

  const email = customer.email || "Guest Buyer"
  const phone = customer.phone || "—"
  const spendingLimit =
    employee.spending_limit !== undefined && employee.spending_limit !== null
      ? `€${Number(employee.spending_limit).toLocaleString()}`
      : employee.is_admin
      ? "Unlimited (Manager)"
      : "—"

  const currency = (
    quote.draft_order?.currency_code ||
    quote.cart?.currency_code ||
    "EUR"
  ).toUpperCase()

  const originalTotal =
    quote.cart?.total ??
    quote.draft_order?.total ??
    0

  const itemsSubtotal = isEditing
    ? Object.values(editedItems).reduce(
        (sum, it) => sum + Number(it.quantity || 1) * Number(it.unit_price || 0),
        0
      )
    : quote.metadata?.items_negotiated?.length
    ? quote.metadata.items_negotiated.reduce(
        (sum: number, it: any) =>
          sum + Number(it.quantity || 1) * Number(it.unit_price || 0),
        0
      )
    : preview?.subtotal ?? quote.draft_order?.subtotal ?? originalTotal

  const effectiveShippingPrice = isEditing
    ? (parseFloat(editedShippingPrice) || 0)
    : (quote.metadata?.admin_shipping_price !== undefined && quote.metadata?.admin_shipping_price !== null
        ? Number(quote.metadata.admin_shipping_price)
        : quote.metadata?.target_shipping_price !== undefined && quote.metadata?.target_shipping_price !== null
        ? Number(quote.metadata.target_shipping_price)
        : 0)

  const quoteTotal = itemsSubtotal + effectiveShippingPrice

  const targetBudget = quote.metadata?.target_price
  const targetShipping = quote.metadata?.target_shipping_price
  const deliveryMode = quote.metadata?.delivery_mode
  const vehicleNote = quote.metadata?.vehicle_note
  const messages: any[] = quote.metadata?.messages || []

  return (
    <div className="flex flex-col gap-y-4 max-w-7xl mx-auto w-full pb-16 p-4 md:p-8">
      {/* Top Back Link */}
      <div>
        <Link
          href="/b2b/quotes"
          className="inline-flex items-center gap-x-1.5 text-xs text-ui-fg-subtle hover:text-ui-fg-base transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Quotes</span>
        </Link>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Left Column (Span 2): Quote Summary + Messages */}
        <div className="lg:col-span-2 flex flex-col gap-y-4">
          {/* Accepted B2B Order Lifecycle & Logistics Panel */}
          {quote.status === "accepted" && (
            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base shadow-sm overflow-hidden divide-y divide-ui-border-base">
              {/* Header */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-x-3">
                  <div className="w-8 h-8 rounded-lg bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center text-ui-fg-base font-semibold text-sm">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-x-2">
                      <Heading level="h3" className="text-sm font-semibold text-ui-fg-base">
                        Order Fulfillment & Settlement
                      </Heading>
                      <Badge color="green" size="small">
                        Confirmed #{quote.draft_order_id ? quote.draft_order_id.replace("order_", "") : "—"}
                      </Badge>
                    </div>
                    <Text className="text-xs text-ui-fg-subtle mt-0.5">
                      Terms accepted by buyer. Manage payment capture, shipment dispatch, and physical delivery.
                    </Text>
                  </div>
                </div>
              </div>

              {/* Milestones Grid */}
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stage 2: Payment Control */}
                <div className="rounded-lg bg-ui-bg-subtle/50 p-4 border border-ui-border-base flex flex-col justify-between gap-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ui-fg-muted uppercase tracking-wider">
                      Stage 2 &bull; Payment
                    </span>
                    {quote.metadata?.payment_status === "paid" || quote.draft_order?.payment_status === "captured" || quote.draft_order?.payment_status === "paid" ? (
                      <Badge color="green" size="small">
                        Paid (Captured)
                      </Badge>
                    ) : (
                      <Badge color="orange" size="small">
                        Awaiting Payment
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-ui-fg-subtle">
                    {quote.metadata?.payment_status === "paid" || quote.draft_order?.payment_status === "captured" || quote.draft_order?.payment_status === "paid" ? (
                      <div>
                        Paid via <strong className="text-ui-fg-base">{quote.metadata?.payment_method || "Direct Payment"}</strong>
                        {quote.metadata?.paid_at && ` on ${new Date(quote.metadata.paid_at).toLocaleString()}`}
                      </div>
                    ) : (
                      <div>Payment has not been recorded yet. Buyer can pay via storefront or you can record payment manually.</div>
                    )}
                  </div>

                  {!(quote.metadata?.payment_status === "paid" || quote.draft_order?.payment_status === "captured" || quote.draft_order?.payment_status === "paid") ? (
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => recordPaymentMutation.mutate()}
                      disabled={recordPaymentMutation.isPending}
                      isLoading={recordPaymentMutation.isPending}
                      className="w-full text-xs h-8"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> Mark Payment Received
                    </Button>
                  ) : (
                    <div className="text-[11px] text-ui-fg-muted flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>Payment confirmed in full</span>
                    </div>
                  )}
                </div>

                {/* Stage 3 & 4: Logistics, Dispatch & Delivery */}
                <div className="rounded-lg bg-ui-bg-subtle/50 p-4 border border-ui-border-base flex flex-col justify-between gap-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ui-fg-muted uppercase tracking-wider">
                      Stages 3 & 4 &bull; Logistics
                    </span>
                    {quote.metadata?.fulfillment_status === "delivered" || quote.draft_order?.fulfillment_status === "delivered" ? (
                      <Badge color="green" size="small">
                        Delivered
                      </Badge>
                    ) : quote.metadata?.fulfillment_status === "shipped" || quote.draft_order?.fulfillment_status === "shipped" ? (
                      <Badge color="blue" size="small">
                        In Transit / Shipped
                      </Badge>
                    ) : (
                      <Badge color="grey" size="small">
                        Pending Dispatch
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-ui-fg-subtle">
                    {quote.metadata?.fulfillment_status === "delivered" || quote.draft_order?.fulfillment_status === "delivered" ? (
                      <div>
                        <div className="text-ui-fg-base font-medium flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Successfully delivered to buyer destination
                        </div>
                        {quote.metadata?.delivered_at && (
                          <div className="text-[11px] text-ui-fg-muted mt-0.5">
                            Delivered at: {new Date(quote.metadata.delivered_at).toLocaleString()}
                          </div>
                        )}
                        <div className="mt-1">
                          Carrier: <strong className="text-ui-fg-base">{quote.metadata?.carrier || "Express Freight"}</strong> &bull; Tracking: <strong className="text-ui-fg-base font-mono">{quote.metadata?.tracking_number || "TRK-ASSIGNED"}</strong>
                        </div>
                      </div>
                    ) : quote.metadata?.fulfillment_status === "shipped" || quote.draft_order?.fulfillment_status === "shipped" ? (
                      <div>
                        <div className="text-ui-fg-base font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Shipment In Transit
                        </div>
                        <div className="mt-1">
                          Carrier: <strong className="text-ui-fg-base">{quote.metadata?.carrier || "Express Freight"}</strong> &bull; Tracking: <strong className="text-ui-fg-base font-mono">{quote.metadata?.tracking_number || "TRK-ASSIGNED"}</strong>
                        </div>
                      </div>
                    ) : (
                      <div>Order packed and ready. Click Dispatch below to assign carrier and tracking number.</div>
                    )}
                  </div>

                  {/* Actions for Stages 3 and 4 */}
                  {!showDispatchForm ? (
                    <div className="flex flex-col gap-y-2 pt-1 border-t border-ui-border-base/50">
                      <div className="flex items-center gap-x-2">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => setShowDispatchForm(true)}
                          className="flex-1 text-xs h-8"
                        >
                          {quote.metadata?.fulfillment_status === "delivered" || quote.metadata?.fulfillment_status === "shipped"
                            ? "Edit Carrier / Tracking"
                            : "Dispatch to Buyer's Location"}
                        </Button>

                        {!(quote.metadata?.fulfillment_status === "delivered" || quote.draft_order?.fulfillment_status === "delivered") && (
                          <Button
                            size="small"
                            variant="primary"
                            onClick={() => deliverOrderMutation.mutate()}
                            disabled={deliverOrderMutation.isPending}
                            isLoading={deliverOrderMutation.isPending}
                            className="flex-1 text-xs h-8"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Mark Delivered
                          </Button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => resetFulfillmentMutation.mutate()}
                        disabled={resetFulfillmentMutation.isPending}
                        className="text-[11px] text-ui-fg-muted hover:text-ui-fg-base text-center py-0.5 transition-colors cursor-pointer"
                      >
                        Reset Status to Pending Dispatch
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-y-2 pt-2 border-t border-ui-border-base/50">
                      <div>
                        <label className="text-[11px] font-medium text-ui-fg-subtle mb-1 block">
                          Carrier Name
                        </label>
                        <Input
                          size="small"
                          placeholder="e.g. DHL Express Freight"
                          value={carrierInput}
                          onChange={(e) => setCarrierInput(e.target.value)}
                          className="text-xs h-7"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-ui-fg-subtle mb-1 block">
                          Tracking Number
                        </label>
                        <Input
                          size="small"
                          placeholder="e.g. TRK-902184"
                          value={trackingInput}
                          onChange={(e) => setTrackingInput(e.target.value)}
                          className="text-xs h-7 font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-x-2 pt-1">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => setShowDispatchForm(false)}
                          className="text-xs h-7 flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="small"
                          variant="primary"
                          onClick={() => dispatchOrderMutation.mutate()}
                          disabled={dispatchOrderMutation.isPending}
                          isLoading={dispatchOrderMutation.isPending}
                          className="text-xs h-7 flex-1"
                        >
                          Confirm Dispatch
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Card 1: Quote Summary */}
          <div className="rounded-xl border bg-ui-bg-base shadow-sm overflow-hidden divide-y divide-ui-border-base">
            {/* Header */}
            <div className="p-6 flex items-center justify-between">
              <Heading level="h2" className="text-base font-semibold">
                Quote Summary
              </Heading>
              <div className="flex items-center gap-x-2">
                {["pending_merchant", "customer_rejected", "merchant_rejected"].includes(quote.status) && (
                  <Button
                    size="small"
                    variant="secondary"
                    className="h-7 text-xs"
                    onClick={() => setIsEditing(true)}
                  >
                    <PencilSquare className="w-3.5 h-3.5 mr-1" />
                    Manage Quote
                  </Button>
                )}
                <Badge color={getStatusColor(quote.status) as any} size="xsmall" className="gap-x-1">
                  <span>&bull;</span>
                  <span>{StatusTitles[quote.status] || quote.status}</span>
                </Badge>
                <DropdownMenu>
                  <DropdownMenu.Trigger asChild>
                    <IconButton size="small" variant="transparent">
                      <EllipsisHorizontal />
                    </IconButton>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content>
                    <DropdownMenu.Item
                      className="gap-x-2"
                      onClick={() => setIsEditing(true)}
                    >
                      <PencilSquare />
                      <span>Manage Items & Prices</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="gap-x-2"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      <PencilSquare />
                      <span>{isEditing ? "Close Inline Pricing Editor" : "Inline Quick Edit"}</span>
                    </DropdownMenu.Item>
                    {quote.status === "pending_merchant" && (
                      <DropdownMenu.Item
                        className="gap-x-2 text-ui-fg-error"
                        onClick={() => rejectQuote()}
                      >
                        <Trash />
                        <span>Reject Quote</span>
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu>
              </div>
            </div>

            {/* Buyer Request Message Callout */}
            {messages.some((m: any) => m.sender === "customer") && (
              <div className="px-6 py-4 bg-ui-bg-subtle border-b border-ui-border-base flex items-start gap-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-sm">
                  <DocumentText className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-ui-fg-base uppercase tracking-wider block">
                    Buyer Request Note
                  </span>
                  <p className="text-sm text-ui-fg-subtle whitespace-pre-wrap font-medium">
                    {messages.find((m: any) => m.sender === "customer")?.text}
                  </p>
                </div>
              </div>
            )}

            {/* Target Price & Delivery Fulfillment Banner */}
            {(targetBudget || targetShipping !== undefined || deliveryMode) && (
              <div className="px-6 py-3.5 bg-blue-50/70 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-blue-900 gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {targetBudget && (
                    <span className="font-medium">
                      Buyer Target Products: <strong className="font-mono text-sm">{Number(targetBudget).toFixed(2)} {currency}</strong>
                    </span>
                  )}
                  {deliveryMode === "customer_vehicle_pickup" && (
                    <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 text-[11px] font-semibold border border-amber-300">
                      Self-Pickup (Customer&apos;s Own Vehicle) &bull; {currency}0.00 Delivery Fee
                    </span>
                  )}
                  {deliveryMode === "free_delivery" && (
                    <span className="px-2.5 py-1 rounded-md bg-green-100 text-green-900 text-[11px] font-semibold border border-green-300">
                      Requested Free Delivery &bull; {currency}0.00
                    </span>
                  )}
                  {deliveryMode === "custom_budget" && (
                    <span className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-900 text-[11px] font-semibold border border-blue-300">
                      Target Freight Budget: {currency}{Number(targetShipping || 0).toFixed(2)}
                    </span>
                  )}
                  {vehicleNote && (
                    <span className="text-[11px] text-amber-800 italic">
                      Note: &ldquo;{vehicleNote}&rdquo;
                    </span>
                  )}
                </div>
                {originalTotal > 0 && targetBudget && (
                  <span className="text-blue-700">
                    Requested product discount: {((1 - Number(targetBudget) / Number(originalTotal)) * 100).toFixed(0)}% off
                  </span>
                )}
              </div>
            )}

            {/* Items List */}
            <div className="p-6 divide-y divide-ui-border-base">
              {items.map((item: any) => {
                const negotiatedItem =
                  quote.metadata?.items_negotiated?.find((ni: any) => ni.id === item.id) ||
                  quote.metadata?.items_negotiated?.[0]

                const defaultUnit =
                  negotiatedItem?.unit_price !== undefined
                    ? Number(negotiatedItem.unit_price)
                    : Number(item.unit_price || 0)

                const defaultQty =
                  negotiatedItem?.quantity !== undefined
                    ? Number(negotiatedItem.quantity)
                    : Number(item.quantity || 1)

                const currentEdit = editedItems[item.id] || {
                  quantity: defaultQty,
                  unit_price: defaultUnit,
                }

                const effectiveUnitPrice = isEditing
                  ? Number(currentEdit.unit_price)
                  : defaultUnit

                const effectiveQuantity = isEditing
                  ? Number(currentEdit.quantity)
                  : defaultQty

                const itemLineTotal = effectiveQuantity * effectiveUnitPrice

                return (
                  <div
                    key={item.id}
                    className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-x-4">
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-lg bg-ui-bg-subtle border border-ui-border-base overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <DocumentText className="text-ui-fg-muted w-6 h-6" />
                        )}
                      </div>

                      {/* Title & SKU */}
                      <div>
                        <div className="text-sm font-medium text-ui-fg-base">
                          {item.title}
                        </div>
                        {item.variant_title && (
                          <div className="text-xs text-ui-fg-subtle">
                            {item.variant_title}
                          </div>
                        )}
                        <div className="flex items-center gap-x-1.5 mt-1">
                          <span className="text-[11px] font-mono text-ui-fg-subtle uppercase">
                            {item.variant_sku || item.variant?.sku || "SKU-N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Price & Quantity */}
                    <div className="flex items-center gap-x-6 text-right">
                      {isEditing ? (
                        <div className="flex items-center gap-x-2">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase text-ui-fg-subtle block">Qty</span>
                            <Input
                              type="number"
                              min="1"
                              className="w-16 text-center text-xs"
                              value={currentEdit.quantity}
                              onChange={(e) =>
                                setEditedItems((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    quantity: parseInt(e.target.value) || 1,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase text-ui-fg-subtle block">
                              Unit Price ({currency})
                            </span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-24 text-right text-xs"
                              value={currentEdit.unit_price}
                              onChange={(e) =>
                                setEditedItems((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    unit_price: parseFloat(e.target.value) || 0,
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm">
                          <span className="text-ui-fg-subtle">
                            {currency === "EUR" ? "€" : currency}{Number(effectiveUnitPrice).toFixed(2)}
                          </span>
                          <span className="text-ui-fg-muted mx-2">{effectiveQuantity} x</span>
                        </div>
                      )}

                      <div className="font-mono text-sm font-semibold text-ui-fg-base min-w-[70px]">
                        {currency === "EUR" ? "€" : currency}{Number(itemLineTotal).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )
              })}

              {isEditing && (
                <div className="pt-4 border-t space-y-4">
                  {/* Delivery Fee Negotiation Box */}
                  <div className="bg-ui-bg-subtle/60 p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-ui-fg-base flex items-center gap-1.5">
                        <DocumentText className="w-3.5 h-3.5" /> Quoted Delivery / Freight Terms
                      </div>
                      <p className="text-[11px] text-ui-fg-subtle">
                        Specify whether delivery is complimentary ({currency}0.00) or charge a custom logistics fee.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="small"
                        type="button"
                        variant={Number(editedShippingPrice) === 0 ? "primary" : "secondary"}
                        onClick={() => setEditedShippingPrice("0.00")}
                      >
                        Free Delivery ({currency}0.00)
                      </Button>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-ui-fg-subtle font-mono">{currency === "EUR" ? "€" : currency}</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24 text-right text-xs"
                          placeholder="0.00"
                          value={editedShippingPrice}
                          onChange={(e) => setEditedShippingPrice(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-ui-fg-subtle">
                      Review product line prices and delivery terms above, then click Save Price Changes.
                    </div>
                    <div className="flex items-center gap-x-2">
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        onClick={() => saveItemChanges()}
                        isLoading={isSavingItems}
                      >
                        Save Price Changes
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Totals Section */}
            <div className="p-6 space-y-2 text-sm bg-ui-bg-subtle/10 border-t">
              <div className="flex justify-between text-ui-fg-subtle">
                <span>Products Subtotal</span>
                <span className="font-mono">{currency === "EUR" ? "€" : currency}{Number(itemsSubtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-ui-fg-subtle">
                <span className="flex items-center gap-1.5">
                  Delivery / Logistics
                  {effectiveShippingPrice === 0 ? (
                    <Badge color="green" size="xsmall">
                      <DocumentText className="w-2.5 h-2.5 mr-0.5" /> Free Delivery Included
                    </Badge>
                  ) : (
                    <Badge color="blue" size="xsmall">
                      <DocumentText className="w-2.5 h-2.5 mr-0.5" /> Quoted Fee
                    </Badge>
                  )}
                </span>
                <span className="font-mono font-medium">
                  {effectiveShippingPrice === 0 ? `${currency === "EUR" ? "€" : currency}0.00 (Free)` : `${currency === "EUR" ? "€" : currency}${Number(effectiveShippingPrice).toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-base text-ui-fg-base pt-2 border-t">
                <span>Total Quoted</span>
                <span className="font-mono text-ui-fg-interactive">
                  {currency === "EUR" ? "€" : currency}{Number(quoteTotal).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 flex items-center justify-between gap-x-3 bg-ui-bg-subtle/30">
              <div>
                {["pending_merchant", "customer_rejected", "merchant_rejected"].includes(quote.status) && (
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => setIsEditing(true)}
                  >
                    <PencilSquare className="w-4 h-4 mr-1.5" />
                    Manage Quote (Edit Items & Prices)
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-x-3">
                {["pending_merchant", "pending_customer"].includes(quote.status) && (
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => rejectQuote()}
                    isLoading={isRejecting}
                    disabled={isEditing}
                  >
                    Reject Quote
                  </Button>
                )}
                {["pending_merchant", "pending_customer"].includes(quote.status) && (
                  <Button
                    size="small"
                    variant="primary"
                    onClick={() => acceptQuote()}
                    isLoading={isAccepting}
                    disabled={isEditing}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Accept & Confirm Order
                  </Button>
                )}
                {["pending_merchant", "customer_rejected", "merchant_rejected"].includes(quote.status) && (
                  <Button
                    size="small"
                    onClick={() => sendQuote()}
                    isLoading={isSending}
                    disabled={isEditing}
                  >
                    Send Quote
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Messages */}
          <div className="rounded-xl border bg-ui-bg-base shadow-sm p-6 flex flex-col gap-y-4">
            <Heading level="h2" className="text-base font-semibold">
              Messages
            </Heading>

            {/* Message Thread History */}
            {messages.length > 0 ? (
              <div className="space-y-3 mb-2 max-h-64 overflow-y-auto pr-1">
                {messages.map((msg: any) => {
                  const isMerchant = msg.sender === "merchant"
                  return (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-lg border text-sm ${
                        isMerchant
                          ? "bg-ui-bg-subtle border-ui-border-base ml-6"
                          : "bg-ui-bg-subtle border-blue-500/40 mr-6"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-ui-fg-subtle mb-1.5">
                        <span className={`font-semibold ${isMerchant ? "text-purple-400" : "text-blue-400"}`}>
                          {isMerchant ? "Merchant Offer / Reply" : "Buyer Request"}
                        </span>
                        <span className="font-mono text-[11px]">
                          {msg.created_at
                            ? new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      {msg.item_title && (
                        <div className="text-[11px] text-ui-fg-interactive font-medium mb-1">
                          Ref: {msg.item_title}
                        </div>
                      )}
                      <p className="text-ui-fg-base whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-4 border border-dashed rounded-lg text-center text-xs text-ui-fg-subtle bg-ui-bg-subtle/40">
                No messages yet. Select a quote item or write a message below to start the negotiation.
              </div>
            )}

            {/* Pick Quote Item Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs text-ui-fg-subtle font-medium">Pick Quote Item</label>
              <select
                className="w-full h-9 rounded-md border border-ui-border-base bg-ui-bg-base px-3 text-sm text-ui-fg-base focus:outline-none focus:border-ui-border-interactive"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
              >
                <option value="general">Select Item</option>
                {items.map((i: any) => (
                  <option key={i.id} value={i.id}>
                    {i.title} {i.variant_title ? `(${i.variant_title})` : ""}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-ui-fg-subtle block">
                Select a quote item to write a message around
              </span>
            </div>

            {/* Message Textarea */}
            <div>
              <Textarea
                rows={4}
                placeholder="Write a message, special pricing note, or bulk discount terms..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
            </div>

            {/* Send Message Button */}
            <div className="flex justify-end">
              <Button
                size="small"
                onClick={() => postMessage()}
                disabled={!messageText.trim() || isPostingMessage}
                isLoading={isPostingMessage}
              >
                Send
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Customer & Company Cards */}
        <div className="flex flex-col gap-y-4">
          {/* Customer Card */}
          <div className="rounded-xl border bg-ui-bg-base shadow-sm p-6 space-y-4">
            <Heading level="h3" className="text-sm font-semibold">
              Customer
            </Heading>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-ui-fg-subtle block">Email</span>
                <a
                  href={`mailto:${email}`}
                  className="text-ui-fg-interactive hover:underline font-mono text-xs"
                >
                  {email}
                </a>
              </div>
              <div>
                <span className="text-xs text-ui-fg-subtle block">Phone</span>
                <span className="text-ui-fg-base">{phone}</span>
              </div>
              <div>
                <span className="text-xs text-ui-fg-subtle block">Account Type</span>
                <span className="text-ui-fg-base text-xs">
                  {company.name ? "B2B Company Member (Private Limits)" : "Direct Independent Buyer"}
                </span>
              </div>
            </div>
          </div>

          {/* Company Card */}
          <div className="rounded-xl border bg-ui-bg-base shadow-sm p-6 space-y-4">
            <Heading level="h3" className="text-sm font-semibold">
              Company
            </Heading>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-ui-fg-subtle block">Name</span>
                <span className="text-ui-fg-base font-medium">
                  {company.name || "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Developer / Raw JSON Card */}
          <div className="rounded-xl border bg-ui-bg-base shadow-sm p-4">
            <button
              onClick={() => setShowJson(!showJson)}
              className="w-full flex items-center justify-between text-xs text-ui-fg-subtle hover:text-ui-fg-base font-mono"
            >
              <span>JSON {Object.keys(quote).length} keys</span>
              <EllipsisHorizontal className="w-4 h-4" />
            </button>
            {showJson && (
              <pre className="mt-3 p-3 bg-ui-bg-subtle rounded-md text-[10px] font-mono overflow-x-auto max-h-60">
                {JSON.stringify(quote, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
