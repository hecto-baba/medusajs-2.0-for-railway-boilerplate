"use client"

import {
  deleteVendorVenue,
  getVendorVenue,
  type VendorVenue,
} from "@lib/data/vendor-client"
import { ActionMenu, SectionRow, Thumbnail } from "@modules/common"
import { useBreadcrumbTitle } from "@modules/layout"
import {
  ArrowLeft,
  Buildings,
  Calendar,
  PencilSquare,
  Trash,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ROW_TYPE_STYLES, SeatChart } from "../common/seat-chart"
import { VenueEditDrawer } from "../forms/venue-edit-drawer"

type VenueDetailProps = {
  id: string
}

export const VenueDetail = ({ id }: VenueDetailProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isEditOpen, setIsEditOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-venue", id],
    queryFn: () => getVendorVenue(id),
  })

  const venue = data?.venue

  useBreadcrumbTitle(venue?.name)

  const deleteMutation = useMutation({
    mutationFn: (venueId: string) => deleteVendorVenue(venueId),
    onSuccess: () => {
      toast.success("Venue deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-venues"] })
      router.push("/venues")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete venue")
    },
  })

  const handleDelete = async () => {
    if (!venue) return

    const confirmed = await prompt({
      title: "Delete Venue",
      description: `Are you sure you want to delete "${venue.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(venue.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text size="small" className="text-ui-fg-subtle">
          Loading venue details...
        </Text>
      </div>
    )
  }

  if (error || !venue) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-y-4">
        <Text size="small" className="text-ui-fg-error">
          Venue not found or access denied.
        </Text>
        <Link href="/venues">
          <Button variant="secondary" size="small">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Venues
          </Button>
        </Link>
      </div>
    )
  }

  const rows = venue.rows || []
  const totalCapacity = rows.reduce(
    (total, r) => total + (r.seat_count || 0),
    0
  )
  const shows = venue.shows || []

  return (
    <div className="flex flex-col gap-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-4">
          <Link href="/venues">
            <Button variant="secondary" size="small">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-x-2">
              <Heading level="h1">{venue.name}</Heading>
              <Badge size="small" color="purple">
                {totalCapacity} seats
              </Badge>
              <Badge size="small" color="grey">
                {rows.length} rows
              </Badge>
            </div>
            {venue.address && (
              <Text size="small" className="text-ui-fg-subtle mt-0.5">
                {venue.address}
              </Text>
            )}
          </div>
        </div>

        <div className="flex items-center gap-x-2">
          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Edit Venue",
                    icon: <PencilSquare className="h-4 w-4" />,
                    onClick: () => setIsEditOpen(true),
                  },
                  {
                    label: "Delete Venue",
                    icon: <Trash className="h-4 w-4 text-ui-fg-error" />,
                    onClick: handleDelete,
                  },
                ],
              },
            ]}
          />
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: General Details & Rows Table */}
        <div className="flex flex-col gap-y-6">
          <Container className="p-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ui-bg-subtle text-ui-fg-subtle">
                  <Buildings className="h-5 w-5" />
                </div>
                <div>
                  <Heading level="h2">Venue Information</Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    General details and configuration
                  </Text>
                </div>
              </div>
            </div>

            <div className="flex flex-col divide-y pt-2">
              <SectionRow title="Venue Name" value={venue.name} />
              <SectionRow
                title="Address"
                value={venue.address || "No address provided"}
              />
              <SectionRow
                title="Total Capacity"
                value={
                  <Badge size="small" color="purple">
                    {totalCapacity} Total Seats
                  </Badge>
                }
              />
              <SectionRow
                title="Total Rows"
                value={`${rows.length} rows configured`}
              />
              <SectionRow
                title="Created Date"
                value={
                  venue.created_at
                    ? new Date(venue.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "-"
                }
              />
            </div>
          </Container>

          {/* Seating Tiers & Breakdown Table */}
          <Container className="p-0 overflow-hidden">
            <div className="p-4 border-b">
              <Heading level="h3">Rows & Seating Breakdown</Heading>
            </div>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Row</Table.HeaderCell>
                  <Table.HeaderCell>Tier</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Seats</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((row, idx) => {
                  const style =
                    ROW_TYPE_STYLES[row.row_type] ?? ROW_TYPE_STYLES.standard
                  return (
                    <Table.Row key={row.id || idx}>
                      <Table.Cell className="font-bold text-ui-fg-base">
                        Row {row.row_number}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge size="small" color={style.badgeColor}>
                          {style.label}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-right font-medium">
                        {row.seat_count} seats
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table>
          </Container>
        </div>

        {/* Right Column: Interactive Seat Chart & Hosted Shows */}
        <div className="flex flex-col gap-y-6">
          <Container className="p-6">
            <div className="border-b pb-4 mb-4">
              <Heading level="h2">Seating Layout Chart</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Stage plan view with tier colour coding
              </Text>
            </div>
            <SeatChart rows={rows} />
          </Container>

          {/* Hosted Shows Section */}
          <Container className="p-6">
            <div className="border-b pb-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <Calendar className="h-5 w-5 text-ui-fg-subtle" />
                <Heading level="h2">Shows at this Venue</Heading>
              </div>
              <Badge size="small" color="grey">
                {shows.length} {shows.length === 1 ? "show" : "shows"}
              </Badge>
            </div>

            {shows.length === 0 ? (
              <div className="py-8 text-center text-ui-fg-subtle text-sm">
                No shows currently scheduled at this venue.
              </div>
            ) : (
              <div className="divide-y divide-ui-border-base">
                {shows.map((show) => (
                  <div
                    key={show.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-x-3">
                      <Thumbnail src={show.product?.thumbnail} />
                      <div>
                        <Link
                          href={`/shows/${show.id}`}
                          className="font-medium text-ui-fg-base hover:underline text-sm"
                        >
                          {show.product?.title || "Untitled Show"}
                        </Link>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {show.dates?.length ?? 0} performance dates
                        </Text>
                      </div>
                    </div>
                    <Link href={`/shows/${show.id}`}>
                      <Button size="small" variant="secondary">
                        View Show
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Container>
        </div>
      </div>

      {/* Edit Drawer */}
      <VenueEditDrawer
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        venue={venue}
      />
    </div>
  )
}
