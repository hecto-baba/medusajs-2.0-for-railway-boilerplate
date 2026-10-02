"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  ArrowLeft,
  BuildingStorefront,
  CheckCircle,
  DocumentText,
  User,
  XCircle,
} from "@medusajs/icons"
import Link from "next/link"
import {
  getVendorQuote,
  negotiateVendorQuote,
  updateVendorQuoteStatus,
  VendorQuoteItem,
} from "@lib/data/vendor-client"

const STATUS_TITLES: Record<string, string> = {
  accepted: "Accepted",
  customer_rejected: "Customer Rejected",
  merchant_rejected: "Merchant Rejected",
  pending_merchant: "Pending Merchant",
  pending_customer: "Pending Customer",
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Negotiation items state
  const [items, setItems] = useState<
    { id: string; title: string; quantity: number; unit_price: number }[]
  >([])
  const [shippingFee, setShippingFee] = useState<string>("0")

  // Fetch Quote Detail
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-quote", id],
    queryFn: () => getVendorQuote(id),
    enabled: !!id,
  })

  const quote = data?.quote
  const customer = quote?.customer
  const company = customer?.employee?.company
  const currency = quote?.draft_order?.currency_code ?? quote?.cart?.currency_code ?? "EUR"

  // Populate items when quote loads
  useEffect(() => {
    if (quote) {
      const rawItems: VendorQuoteItem[] =
        quote.draft_order?.items || quote.cart?.items || []

      const formatted = rawItems.map((it, idx) => ({
        id: it.id || `item_${idx}`,
        title: it.title || "Quoted Product",
        quantity: it.quantity || 1,
        unit_price: it.unit_price || 0,
      }))
      setItems(formatted)

      const shipping =
        quote.metadata?.vendor_shipping_price ??
        quote.metadata?.admin_shipping_price ??
        quote.draft_order?.shipping_total ??
        0
      setShippingFee(String(shipping))
    }
  }, [quote])

  // Computed Totals
  const subtotal = items.reduce(
    (acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
    0
  )
  const shippingNum = parseFloat(shippingFee) || 0
  const grandTotal = subtotal + shippingNum

  // Negotiate Mutation
  const negotiateMutation = useMutation({
    mutationFn: (newStatus?: string) =>
      negotiateVendorQuote(id, {
        status: newStatus || "pending_customer",
        items_negotiated: items,
        vendor_shipping_price: shippingNum,
      }),
    onSuccess: (_, newStatus) => {
      toast.success("Success", {
        description:
          newStatus === "accepted"
            ? "Quote accepted and finalized!"
            : newStatus === "merchant_rejected"
            ? "Quote rejected."
            : "Counter-offer sent to the wholesale buyer!",
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-quote", id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-quotes"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to update quote" })
    },
  })

  const updateItemPrice = (idx: number, newPrice: string) => {
    const val = parseFloat(newPrice) || 0
    setItems((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], unit_price: val }
      return copy
    })
  }

  if (isLoading || !quote) {
    return <div className="p-8 text-center text-ui-fg-subtle">Loading quote details...</div>
  }

  return (
    <div className="flex flex-col gap-y-6 max-w-5xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div>
        <Link
          href="/b2b/quotes"
          className="text-xs font-semibold text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Quotes
        </Link>
        <div className="flex items-center justify-between mt-2">
          <Heading level="h1" className="text-2xl font-bold flex items-center gap-2">
            <DocumentText className="w-6 h-6 text-ui-fg-base" />
            Negotiate Quote: {quote.id.slice(0, 16)}...
          </Heading>
          <Badge color={quote.status === "accepted" ? "green" : "blue"} size="small">
            {STATUS_TITLES[quote.status] || quote.status}
          </Badge>
        </div>
      </div>

      {/* Buyer & Corporate Card */}
      <Container className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-ui-fg-subtle mt-0.5 shrink-0" />
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
                Corporate Buyer
              </Text>
              <Text className="text-sm font-medium text-ui-fg-base mt-0.5">
                {customer?.first_name || ""} {customer?.last_name || ""} ({customer?.email || "No email"})
              </Text>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <BuildingStorefront className="w-5 h-5 text-ui-fg-subtle mt-0.5 shrink-0" />
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
                Company Account
              </Text>
              <Text className="text-sm font-medium text-ui-fg-base mt-0.5">
                {company?.name || "Direct Wholesale Buyer"}
              </Text>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DocumentText className="w-5 h-5 text-ui-fg-subtle mt-0.5 shrink-0" />
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
                Created Date
              </Text>
              <Text className="text-sm font-medium text-ui-fg-base mt-0.5">
                {new Date(quote.created_at).toLocaleString()}
              </Text>
            </div>
          </div>
        </div>
      </Container>

      {/* Negotiation Table */}
      <Container className="p-0 overflow-hidden divide-y divide-ui-border-base">
        <div className="p-4 flex items-center justify-between">
          <div>
            <Heading level="h3" className="text-base font-semibold">
              Quoted Line Items & Unit Pricing
            </Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Adjust wholesale unit prices to prepare a counter-offer or agreed quote.
            </Text>
          </div>
        </div>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Product</Table.HeaderCell>
              <Table.HeaderCell>Quantity</Table.HeaderCell>
              <Table.HeaderCell>Quoted Unit Price ({currency.toUpperCase()})</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Line Total</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((it, idx) => (
              <Table.Row key={it.id}>
                <Table.Cell className="font-medium text-ui-fg-base">
                  {it.title}
                </Table.Cell>
                <Table.Cell className="text-sm">
                  {it.quantity} units
                </Table.Cell>
                <Table.Cell className="max-w-[180px]">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={it.unit_price}
                    onChange={(e) => updateItemPrice(idx, e.target.value)}
                    className="font-mono text-sm w-36"
                  />
                </Table.Cell>
                <Table.Cell className="text-right font-mono font-semibold">
                  {(it.quantity * it.unit_price).toFixed(2)} {currency.toUpperCase()}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>

        {/* Pricing Summary & Shipping Fee */}
        <div className="p-6 bg-ui-bg-subtle/30 flex flex-col items-end gap-y-3">
          <div className="flex items-center justify-between w-72 text-sm text-ui-fg-subtle">
            <span>Items Subtotal:</span>
            <span className="font-mono font-medium text-ui-fg-base">
              {subtotal.toFixed(2)} {currency.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center justify-between w-72 text-sm">
            <span className="text-ui-fg-subtle">Custom Delivery / Shipping:</span>
            <div className="w-28">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
                className="font-mono text-xs text-right"
              />
            </div>
          </div>

          <div className="flex items-center justify-between w-72 text-base font-bold text-ui-fg-base pt-3 border-t border-ui-border-base">
            <span>Grand Total:</span>
            <span className="font-mono text-lg text-emerald-600">
              {grandTotal.toFixed(2)} {currency.toUpperCase()}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-4">
            <Button
              size="small"
              variant="secondary"
              className="text-rose-500 hover:text-rose-600"
              disabled={negotiateMutation.isPending}
              onClick={() => negotiateMutation.mutate("merchant_rejected")}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject Quote
            </Button>
            <Button
              size="small"
              variant="secondary"
              isLoading={negotiateMutation.isPending}
              onClick={() => negotiateMutation.mutate("pending_customer")}
            >
              Send Counter-Offer to Buyer
            </Button>
            <Button
              size="small"
              variant="primary"
              isLoading={negotiateMutation.isPending}
              onClick={() => negotiateMutation.mutate("accepted")}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Accept & Finalize Quote
            </Button>
          </div>
        </div>
      </Container>
    </div>
  )
}
