import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Badge, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types"

type EoiStatus = "pending" | "converted" | "cancelled"

type Eoi = {
  id: string
  variant_id: string
  customer_email: string
  value_type: "fixed" | "percentage"
  value_amount: number
  quoted_unit_price: number
  eoi_charged_amount: number
  remaining_amount: number
  status: EoiStatus
  product_variant?: {
    id: string
    title: string
    product?: {
      id: string
      title: string
      thumbnail: string
    }
  }
}

type EoisResponse = {
  eois: Eoi[]
}

const getStatusBadgeColor = (status: EoiStatus) => {
  switch (status) {
    case "converted":
      return "green"
    case "cancelled":
      return "red"
    case "pending":
      return "orange"
    default:
      return "grey"
  }
}

const formatStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatCurrency = (amount: number) => amount?.toFixed(2)

/**
 * Read-only view on the order detail page showing quoted price, EOI amount
 * charged, and remaining balance for any EOI line items on that order.
 * Mirrors order-rental-items.tsx's shape, minus the status-editing drawer -
 * status transitions for a converted EOI happen on the admin/eois detail
 * page, not here.
 */
const OrderEoiItemsWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const { data } = useQuery<EoisResponse>({
    queryFn: () => sdk.client.fetch(`/admin/orders/${order.id}/eois`),
    queryKey: [["orders", order.id, "eois"]],
  })

  if (!data?.eois.length) {
    return null
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Expression of Interest Items</Heading>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Product</Table.HeaderCell>
            <Table.HeaderCell>Quoted Price</Table.HeaderCell>
            <Table.HeaderCell>Charged</Table.HeaderCell>
            <Table.HeaderCell>Remaining</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.eois.map((eoi) => (
            <Table.Row key={eoi.id}>
              <Table.Cell className="py-4">
                <div className="flex items-start gap-4">
                  {eoi.product_variant?.product?.thumbnail && (
                    <img
                      src={eoi.product_variant.product.thumbnail}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  )}
                  <div>
                    <Text size="small" weight="plus">
                      {eoi.product_variant?.product?.title ?? "-"}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {eoi.product_variant?.title ?? "-"}
                    </Text>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>{formatCurrency(eoi.quoted_unit_price)}</Table.Cell>
              <Table.Cell>
                {formatCurrency(eoi.eoi_charged_amount)}
                {eoi.value_type === "percentage" && (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    ({eoi.value_amount}%)
                  </Text>
                )}
              </Table.Cell>
              <Table.Cell>{formatCurrency(eoi.remaining_amount)}</Table.Cell>
              <Table.Cell>
                <Badge color={getStatusBadgeColor(eoi.status)} size="2xsmall">
                  {formatStatus(eoi.status)}
                </Badge>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderEoiItemsWidget
