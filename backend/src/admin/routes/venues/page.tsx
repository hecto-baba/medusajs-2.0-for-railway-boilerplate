import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Buildings } from "@medusajs/icons"
import {
  Badge,
  Container,
  Heading,
  Table,
  Text,
  Tooltip,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../lib/sdk"
import { CreateVenueModal } from "../../components/create-venue-modal"
import {
  ROW_TYPE_STYLES,
  RowType,
  totalSeats,
  venueRowTypes,
  VenueListResponse,
} from "../../types/ticket-booking"

const PAGE_SIZE = 15

const VenuesPage = () => {
  const [page, setPage] = useState(0)

  const { data, isLoading, refetch } = useQuery<VenueListResponse>({
    queryFn: () =>
      sdk.client.fetch("/admin/venues", {
        query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      }),
    queryKey: [["venues", page]],
  })

  const venues = data?.venues ?? []
  const count = data?.count ?? 0
  const pageCount = Math.max(Math.ceil(count / PAGE_SIZE), 1)

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Venues</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Places you sell tickets for, and the seating rows they hold
          </Text>
        </div>
        <CreateVenueModal onCreated={refetch} />
      </div>

      {isLoading ? (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-subtle">
            Loading venues...
          </Text>
        </div>
      ) : !venues.length ? (
        <div className="px-6 py-12 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            No venues yet. Create one to start selling tickets.
          </Text>
        </div>
      ) : (
        <>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Address</Table.HeaderCell>
                <Table.HeaderCell>Rows</Table.HeaderCell>
                <Table.HeaderCell>Tiers</Table.HeaderCell>
                <Table.HeaderCell className="text-right">
                  Capacity
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {venues.map((venue) => (
                <Table.Row key={venue.id}>
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {venue.name}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {venue.address || "&mdash;"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Tooltip
                      content={(venue.rows || [])
                        .map(
                          (row) =>
                            `${row.row_number}: ${row.seat_count} ${
                              ROW_TYPE_STYLES[row.row_type as RowType]?.label ??
                              row.row_type
                            }`
                        )
                        .join(", ")}
                    >
                      <Text size="small">{venue.rows?.length ?? 0}</Text>
                    </Tooltip>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      {venueRowTypes(venue.rows).map((rowType) => (
                        <Badge
                          key={rowType}
                          size="2xsmall"
                          className={ROW_TYPE_STYLES[rowType].badge}
                        >
                          {ROW_TYPE_STYLES[rowType].label}
                        </Badge>
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text size="small" weight="plus">
                      {totalSeats(venue.rows)}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
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

export const config = defineRouteConfig({
  label: "Venues",
  icon: Buildings,
})

export default VenuesPage
