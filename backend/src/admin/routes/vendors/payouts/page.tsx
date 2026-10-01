import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  StatusBadge,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../../lib/sdk"

type Payout = {
  id: string
  vendor_id: string
  vendor_name: string | null
  order_display_id: number | null
  currency_code: string
  total: number
  refunded_total: number
  net_total: number
  payout_status: "owed" | "paid" | "void"
  payout_reference: string | null
  paid_at: string | null
  created_at: string
}

type PayoutsResponse = {
  payouts: Payout[]
  count: number
  totals: Record<string, { owed: number; paid: number; void: number }>
}

const STATUS_COLOR = { owed: "orange", paid: "green", void: "grey" } as const
const PAGE_SIZE = 50

/**
 * What the platform owes each seller (decision D2: the platform collects the
 * buyer's payment and pays sellers itself). One row per seller order. "Mark paid"
 * records the bank transfer reference once the platform has paid; a paid or void
 * row is final.
 */
const SellerPayoutsPage = () => {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<string>("owed")
  const [page, setPage] = useState(0)
  const [settling, setSettling] = useState<Payout | null>(null)
  const [reference, setReference] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-vendor-payouts", status, page],
    queryFn: () =>
      sdk.client.fetch<PayoutsResponse>("/admin/vendor-payouts", {
        query: {
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          ...(status !== "all" ? { payout_status: status } : {}),
        },
      }),
  })

  const settle = useMutation({
    mutationFn: (input: { id: string; payout_status: "paid" | "void"; payout_reference?: string }) =>
      sdk.client.fetch(`/admin/vendor-payouts/${input.id}`, {
        method: "POST",
        body: { payout_status: input.payout_status, payout_reference: input.payout_reference },
      }),
    onSuccess: () => {
      toast.success("Payout updated")
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-payouts"] })
      setSettling(null)
      setReference("")
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the payout"),
  })

  const payouts = data?.payouts ?? []
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE))

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Seller Payouts</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            What the platform owes each seller, after refunds. Pay the seller yourself, then mark the row paid.
          </Text>
        </div>
        <div className="w-40">
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value)
              setPage(0)
            }}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="owed">Owed</Select.Item>
              <Select.Item value="paid">Paid</Select.Item>
              <Select.Item value="void">Void</Select.Item>
              <Select.Item value="all">All</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 px-6 py-4">
        {Object.entries(data?.totals ?? {}).map(([currency, sums]) => (
          <div key={currency}>
            <Text size="xsmall" className="text-ui-fg-muted uppercase">
              {currency}
            </Text>
            <Text size="small">
              Owed {sums.owed.toFixed(2)} · Paid {sums.paid.toFixed(2)}
            </Text>
          </div>
        ))}
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Seller</Table.HeaderCell>
            <Table.HeaderCell>Order</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Refunded</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Net owed</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Reference</Table.HeaderCell>
            <Table.HeaderCell className="w-48" />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {payouts.map((payout) => (
            <Table.Row key={payout.id}>
              <Table.Cell>{payout.vendor_name ?? payout.vendor_id}</Table.Cell>
              <Table.Cell>{payout.order_display_id ? `#${payout.order_display_id}` : "-"}</Table.Cell>
              <Table.Cell className="text-right">
                {Number(payout.total).toFixed(2)} {payout.currency_code.toUpperCase()}
              </Table.Cell>
              <Table.Cell className="text-right">{Number(payout.refunded_total).toFixed(2)}</Table.Cell>
              <Table.Cell className="text-right">{payout.net_total.toFixed(2)}</Table.Cell>
              <Table.Cell>
                <StatusBadge color={STATUS_COLOR[payout.payout_status]}>{payout.payout_status}</StatusBadge>
              </Table.Cell>
              <Table.Cell>{payout.payout_reference ?? "-"}</Table.Cell>
              <Table.Cell>
                {payout.payout_status === "owed" && (
                  <div className="flex items-center gap-x-2">
                    <Button size="small" variant="secondary" onClick={() => setSettling(payout)}>
                      Mark paid
                    </Button>
                    <Button
                      size="small"
                      variant="transparent"
                      onClick={() => settle.mutate({ id: payout.id, payout_status: "void" })}
                    >
                      Void
                    </Button>
                  </div>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {!isLoading && payouts.length === 0 && (
        <div className="px-6 py-10 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            Nothing here.
          </Text>
        </div>
      )}

      <div className="flex items-center justify-between px-6 py-3">
        <Text size="small" className="text-ui-fg-subtle">
          Page {page + 1} of {pages}
        </Text>
        <div className="flex gap-x-2">
          <Button size="small" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button size="small" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>

      <Drawer open={!!settling} onOpenChange={(open) => !open && setSettling(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Mark as paid</Drawer.Title>
            <Drawer.Description>
              Record the transfer you made to {settling?.vendor_name ?? "the seller"}. A paid entry cannot be changed.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-3 p-6">
            <Text size="small">
              {settling ? `${settling.net_total.toFixed(2)} ${settling.currency_code.toUpperCase()}` : ""}
            </Text>
            <Label size="small" weight="plus">
              Bank transfer reference
            </Label>
            <Input value={reference} onChange={(event) => setReference(event.target.value)} />
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={() => setSettling(null)}>
              Cancel
            </Button>
            <Button
              isLoading={settle.isPending}
              disabled={!reference.trim()}
              onClick={() =>
                settling &&
                settle.mutate({ id: settling.id, payout_status: "paid", payout_reference: reference.trim() })
              }
            >
              Mark paid
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Seller Payouts",
  rank: 4,
})

export default SellerPayoutsPage
