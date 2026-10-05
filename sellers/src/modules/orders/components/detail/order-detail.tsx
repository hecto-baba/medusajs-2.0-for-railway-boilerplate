"use client"

import { getVendorOrder, type VendorOrderDetail } from "@lib/data/vendor-client"
import { Container, Text } from "@medusajs/ui"
import { ArrowLeft } from "@medusajs/icons"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useBreadcrumbTitle } from "@modules/layout"
import { MetadataSection } from "@modules/customers/components/detail/metadata-section"
import { useOrderActions } from "./order-actions"
import { OrderActivitySection } from "./order-activity-section"
import { OrderCustomerSection } from "./order-customer-section"
import { OrderFulfillmentSection } from "./order-fulfillment-section"
import { OrderGeneralSection } from "./order-general-section"
import { OrderJsonSection } from "./order-json-section"
import { OrderPaymentSection } from "./order-payment-section"
import { OrderRentalsSection } from "./order-rentals-section"
import { OrderSummarySection } from "./order-summary-section"

type OrderDetailProps = {
  id: string
}

/**
 * A vendor's own view of a single order, laid out like the admin's order page:
 * header, Summary, Payments and fulfilment in the main column; Customer and
 * Activity in the side column. The seller extras (order actions, rentals) sit
 * in the main column beneath the admin sections.
 */
export const OrderDetail = ({ id }: OrderDetailProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-order", id],
    queryFn: () => getVendorOrder(id),
  })

  const order = data?.order

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Text className="text-ui-fg-muted">Loading order details...</Text>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center gap-y-4 p-16">
        <Text className="text-ui-fg-error">Order not found or access denied.</Text>
        <Link
          href="/orders"
          className="text-ui-fg-subtle hover:text-ui-fg-base inline-flex items-center gap-x-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Orders</span>
        </Link>
      </div>
    )
  }

  return <OrderDetailLoaded order={order} id={id} />
}

const OrderDetailLoaded = ({ order, id }: { order: VendorOrderDetail; id: string }) => {
  const { api: actions, drawers } = useOrderActions(order)

  // Breadcrumb reads "Orders > #36" like the admin, not the raw order id.
  useBreadcrumbTitle(`#${order.display_id}`)

  return (
    <div className="flex flex-col gap-y-3">
      {order.is_mixed && (
        <Container className="p-4" data-testid="legacy-shared-order-note">
          <Text size="small" className="text-ui-fg-subtle">
            This is an older order that also contained other sellers&apos; items. You see only your own
            items; payment, shipping and the whole-order totals are not shown here.
          </Text>
        </Container>
      )}

      <div className="flex flex-col gap-x-4 gap-y-3 xl:flex-row xl:items-start">
        <div className="flex w-full flex-col gap-y-3">
          <OrderGeneralSection order={order} actions={actions} />
          <OrderSummarySection order={order} actions={actions} />
          <OrderPaymentSection order={order} />
          <OrderFulfillmentSection order={order} actions={actions} />
          <OrderRentalsSection orderId={id} />
          <MetadataSection metadata={order.metadata} />
          <OrderJsonSection data={order} />
        </div>

        <div className="flex w-full max-w-[100%] flex-col gap-y-3 xl:mt-0 xl:max-w-[440px]">
          <OrderCustomerSection order={order} />
          <OrderActivitySection order={order} />
        </div>
      </div>
      {drawers}
    </div>
  )
}
