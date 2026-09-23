import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ReceiptPercent } from "@medusajs/icons"
import { Badge, Container, Heading, Table, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"
import { sdk } from "../../lib/sdk"
import { CreateTicketProductModal } from "../../components/create-ticket-product-modal"
import {
  ROW_TYPE_STYLES,
  RowType,
  TicketProductListResponse,
} from "../../types/ticket-booking"

const PAGE_SIZE = 15

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

/** A run is shown as its span, since a show can have many consecutive dates. */
const formatRun = (dates: string[] = []) => {
  if (!dates.length) return "&mdash;"

  const sorted = [...dates].sort()
  const first = formatDate(sorted[0])

  if (sorted.length === 1) return first

  return `${first} - ${formatDate(sorted[sorted.length - 1])}`
}

const TicketProductsPage = () => {
  const [page, setPage] = useState(0)

  const { data, isLoading, refetch } = useQuery<TicketProductListResponse>({
    queryFn: () =>
      sdk.client.fetch("/admin/ticket-products", {
        query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      }),
    queryKey: [["ticket-products", page]],
  })

  const ticketProducts = data?.ticket_products ?? []
  const count = data?.count ?? 0
  const pageCount = Math.max(Math.ceil(count / PAGE_SIZE), 1)

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Shows</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Events sold as tickets, with a performance per date
          </Text>
        </div>
        <CreateTicketProductModal onCreated={refetch} />
      </div>

      {isLoading ? (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-subtle">
            Loading shows...
          </Text>
        </div>
      ) : !ticketProducts.length ? (
        <div className="px-6 py-12 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            No shows yet. Create a venue first, then add a show to it.
          </Text>
        </div>
      ) : (
        <>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Show</Table.HeaderCell>
                <Table.HeaderCell>Venue</Table.HeaderCell>
                <Table.HeaderCell>Run</Table.HeaderCell>
                <Table.HeaderCell>Dates</Table.HeaderCell>
                <Table.HeaderCell>Tiers</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {ticketProducts.map((ticketProduct) => {
                const tiers = Array.from(
                  new Set(
                    (ticketProduct.variants || []).map(
                      (variant) => variant.row_type
                    )
                  )
                )

                return (
                  <Table.Row key={ticketProduct.id}>
                    <Table.Cell>
                      <Link
                        to={`/products/${ticketProduct.product_id}`}
                        className="text-ui-fg-interactive hover:underline"
                      >
                        <Text size="small" weight="plus">
                          {ticketProduct.product?.title ?? ticketProduct.product_id}
                        </Text>
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle">
                        {ticketProduct.venue?.name ?? "&mdash;"}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{formatRun(ticketProduct.dates)}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{ticketProduct.dates?.length ?? 0}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-1">
                        {tiers.map((rowType) => (
                          <Badge
                            key={rowType}
                            size="2xsmall"
                            className={
                              ROW_TYPE_STYLES[rowType as RowType]?.badge
                            }
                          >
                            {ROW_TYPE_STYLES[rowType as RowType]?.label ??
                              rowType}
                          </Badge>
                        ))}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>

          <Table.Pagination
            count={count}
            pageSize={PAGE_SIZE}
            pageIndex={page}
            pageCount={pageCount}
            canPreviousPage={page > 0}
            canNextPage={page < pageCount - 1}
            previousPage={() => setPage((current) => Math.max(current - 1, 0))}
            nextPage={() => setPage((current) => current + 1)}
          />
        </>
      )}
    </Container>
  )
}

export default TicketProductsPage
