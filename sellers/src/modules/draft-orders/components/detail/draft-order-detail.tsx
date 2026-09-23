"use client"

import {
  convertVendorDraftOrder,
  deleteVendorDraftOrder,
  getVendorDraftOrder,
  type VendorDraftOrder,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Container,
  Heading,
  StatusBadge,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import {
  ArrowLeft,
  ArrowPath,
  Buildings,
  CreditCard,
  Trash,
  User,
} from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"

type DraftOrderDetailProps = {
  id: string
}

export const DraftOrderDetail = ({ id }: DraftOrderDetailProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-draft-order", id],
    queryFn: () => getVendorDraftOrder(id),
  })

  const draft = data?.draft_order

  const deleteMutation = useMutation({
    mutationFn: () => deleteVendorDraftOrder(id),
    onSuccess: () => {
      toast.success("Draft order deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-draft-orders"] })
      router.push("/orders/drafts")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete draft order")
    },
  })

  const convertMutation = useMutation({
    mutationFn: () => convertVendorDraftOrder(id),
    onSuccess: (res: any) => {
      toast.success("Draft order converted to live order!")
      queryClient.invalidateQueries({ queryKey: ["vendor-draft-orders"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-orders"] })
      if (res?.order?.id) {
        router.push(`/orders/${res.order.id}`)
      } else {
        router.push("/orders")
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to convert draft order")
    },
  })

  const handleDelete = async () => {
    if (!draft) return

    const confirmed = await prompt({
      title: "Delete Draft Order",
      description: `Are you sure you want to delete draft order #${draft.display_id}?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate()
    }
  }

  const handleConvert = async () => {
    if (!draft) return

    const confirmed = await prompt({
      title: "Convert to Order",
      description: `Convert draft order #${draft.display_id} into a regular completed order?`,
      confirmText: "Convert",
      cancelText: "Cancel",
    })

    if (confirmed) {
      convertMutation.mutate()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Text className="text-ui-fg-muted">Loading draft order details...</Text>
      </div>
    )
  }

  if (error || !draft) {
    return (
      <div className="flex flex-col items-center justify-center gap-y-4 p-16">
        <Text className="text-ui-fg-error">Draft order not found or access denied.</Text>
        <Button variant="secondary" onClick={() => router.push("/orders/drafts")}>
          <ArrowLeft /> Back to Drafts
        </Button>
      </div>
    )
  }

  const items = draft.items || []
  const currency = (draft.currency_code || "USD").toUpperCase()
  const shipping = draft.shipping_address as any
  const billing = draft.billing_address as any

  return (
    <div className="flex flex-col gap-y-6 p-8 max-w-7xl mx-auto">
      {/* Top bar back link */}
      <div>
        <Link
          href="/orders/drafts"
          className="text-ui-fg-subtle hover:text-ui-fg-base inline-flex items-center gap-x-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Draft Orders</span>
        </Link>
      </div>

      {/* Header Container */}
      <Container className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center gap-x-3">
              <Heading level="h1">Draft Order #{draft.display_id}</Heading>
              <StatusBadge color="grey">Draft</StatusBadge>
            </div>
            <Text size="small" className="text-ui-fg-muted">
              Created on{" "}
              {new Date(draft.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </div>

          <div className="flex items-center gap-x-2">
            <Button
              variant="primary"
              size="small"
              onClick={handleConvert}
              isLoading={convertMutation.isPending}
            >
              <ArrowPath className="h-4 w-4" />
              Convert to Order
            </Button>
            <Button
              variant="danger"
              size="small"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
            >
              <Trash className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </Container>

      {/* Grid: Line Items + Customer Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line items and summary */}
        <div className="lg:col-span-2 flex flex-col gap-y-6">
          <Container className="p-6 flex flex-col gap-y-4">
            <Heading level="h2">Items</Heading>
            <div className="border border-ui-border-base rounded-lg overflow-hidden">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Item</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Qty</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Unit Price</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {items.map((it: any) => (
                    <Table.Row key={it.id}>
                      <Table.Cell>
                        <div className="flex flex-col">
                          <Text size="small" weight="plus">
                            {it.title}
                          </Text>
                          {it.variant_title && (
                            <Text size="xsmall" className="text-ui-fg-muted">
                              {it.variant_title}
                            </Text>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-right font-mono text-sm">
                        {it.quantity}
                      </Table.Cell>
                      <Table.Cell className="text-right font-mono text-sm">
                        {currency} {(it.unit_price ?? 0).toFixed(2)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-mono font-medium text-sm">
                        {currency} {((it.quantity ?? 1) * (it.unit_price ?? 0)).toFixed(2)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Container>

          {/* Totals Summary */}
          <Container className="p-6 flex flex-col gap-y-3">
            <Heading level="h2">Order Summary</Heading>
            <div className="flex flex-col gap-y-2 text-sm border-t border-ui-border-base pt-3">
              <div className="flex justify-between">
                <Text className="text-ui-fg-subtle">Subtotal</Text>
                <Text className="font-mono">{currency} {(draft.subtotal ?? draft.total ?? 0).toFixed(2)}</Text>
              </div>
              <div className="flex justify-between">
                <Text className="text-ui-fg-subtle">Shipping</Text>
                <Text className="font-mono">{currency} {(draft.shipping_total ?? 0).toFixed(2)}</Text>
              </div>
              <div className="flex justify-between">
                <Text className="text-ui-fg-subtle">Taxes</Text>
                <Text className="font-mono">{currency} {(draft.tax_total ?? 0).toFixed(2)}</Text>
              </div>
              <div className="flex justify-between border-t border-ui-border-base pt-2 font-bold text-base">
                <Text weight="plus">Total</Text>
                <Text weight="plus" className="font-mono">{currency} {(draft.total ?? 0).toFixed(2)}</Text>
              </div>
            </div>
          </Container>
        </div>

        {/* Customer & Address Details */}
        <div className="flex flex-col gap-y-6">
          <Container className="p-6 flex flex-col gap-y-3">
            <div className="flex items-center gap-x-2">
              <User className="text-ui-fg-muted h-5 w-5" />
              <Heading level="h2">Customer</Heading>
            </div>
            <div className="flex flex-col gap-y-1 text-sm border-t border-ui-border-base pt-3">
              <Text weight="plus">
                {[draft.customer?.first_name, draft.customer?.last_name]
                  .filter(Boolean)
                  .join(" ") || "Guest"}
              </Text>
              <Text className="text-ui-fg-subtle">{draft.email || "No email"}</Text>
            </div>
          </Container>

          {/* Shipping Address */}
          <Container className="p-6 flex flex-col gap-y-3">
            <div className="flex items-center gap-x-2">
              <Buildings className="text-ui-fg-muted h-5 w-5" />
              <Heading level="h2">Shipping Address</Heading>
            </div>
            <div className="flex flex-col gap-y-1 text-sm border-t border-ui-border-base pt-3 text-ui-fg-subtle">
              {shipping ? (
                <>
                  <Text weight="plus" className="text-ui-fg-base">
                    {[shipping.first_name, shipping.last_name].filter(Boolean).join(" ")}
                  </Text>
                  {shipping.address_1 && <Text>{shipping.address_1}</Text>}
                  <Text>
                    {[shipping.city, shipping.postal_code].filter(Boolean).join(" ")}
                  </Text>
                  {shipping.country_code && (
                    <Text className="uppercase">{shipping.country_code}</Text>
                  )}
                </>
              ) : (
                <Text className="text-ui-fg-muted">No shipping address</Text>
              )}
            </div>
          </Container>

          {/* Billing Address */}
          <Container className="p-6 flex flex-col gap-y-3">
            <div className="flex items-center gap-x-2">
              <CreditCard className="text-ui-fg-muted h-5 w-5" />
              <Heading level="h2">Billing Address</Heading>
            </div>
            <div className="flex flex-col gap-y-1 text-sm border-t border-ui-border-base pt-3 text-ui-fg-subtle">
              {billing ? (
                <>
                  <Text weight="plus" className="text-ui-fg-base">
                    {[billing.first_name, billing.last_name].filter(Boolean).join(" ")}
                  </Text>
                  {billing.address_1 && <Text>{billing.address_1}</Text>}
                  <Text>
                    {[billing.city, billing.postal_code].filter(Boolean).join(" ")}
                  </Text>
                  {billing.country_code && (
                    <Text className="uppercase">{billing.country_code}</Text>
                  )}
                </>
              ) : (
                <Text className="text-ui-fg-muted">Same as shipping address</Text>
              )}
            </div>
          </Container>
        </div>
      </div>
    </div>
  )
}
