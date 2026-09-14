"use client"

import {
  deleteVendorStockLocation,
  getVendorStockLocation,
  type VendorStockLocation,
} from "@lib/data/vendor-client"
import {
  ArrowLeft,
  BuildingStorefront,
  Channels,
  MapPin,
  PencilSquare,
  Trash,
  TruckFast,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  StatusBadge,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { LocationEditDrawer } from "./location-edit-drawer"

type LocationDetailProps = {
  id: string
}

export const LocationDetail = ({ id }: LocationDetailProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [editOpen, setEditOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-stock-location", id],
    queryFn: () => getVendorStockLocation(id),
  })

  const { mutateAsync: removeLocation, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteVendorStockLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-stock-locations"] })
      toast.success("Location deleted")
      router.push("/settings/locations")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete location")
    },
  })

  const handleDelete = async () => {
    const locName = data?.stock_location?.name || "this location"
    const confirmed = await prompt({
      title: "Delete location",
      description: `Are you sure you want to delete "${locName}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      await removeLocation()
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text size="small" className="text-ui-fg-subtle">
          Loading location details...
        </Text>
      </div>
    )
  }

  if (error || !data?.stock_location) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <Link
            href="/settings/locations"
            className="flex items-center gap-x-2 text-ui-fg-subtle hover:text-ui-fg-base text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to locations
          </Link>
        </div>
        <Container className="p-6 text-center">
          <Heading level="h3" className="text-ui-fg-error mb-2">
            Location Not Found
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mb-4">
            The requested stock location does not exist or you do not have permission to access it.
          </Text>
          <Button variant="secondary" onClick={() => router.push("/settings/locations")}>
            Return to Locations
          </Button>
        </Container>
      </div>
    )
  }

  const location = data.stock_location
  const addr = location.address

  return (
    <div className="flex flex-col gap-y-6 p-6">
      {/* Top navigation & action header */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings/locations"
          className="flex items-center gap-x-2 text-ui-fg-subtle hover:text-ui-fg-base text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to locations
        </Link>
        <div className="flex items-center gap-x-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => setEditOpen(true)}
          >
            <PencilSquare />
            Edit Location
          </Button>
          <Button
            size="small"
            variant="danger"
            isLoading={isDeleting}
            onClick={handleDelete}
          >
            <Trash />
            Delete
          </Button>
        </div>
      </div>

      {/* Title section */}
      <div className="flex items-center gap-x-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-ui-bg-subtle shadow-sm">
          <BuildingStorefront className="h-6 w-6 text-ui-fg-base" />
        </div>
        <div>
          <Heading level="h1">{location.name}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Created on{" "}
            {new Date(location.created_at).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Address Card */}
        <Container className="p-6 flex flex-col gap-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-x-2">
              <MapPin className="text-ui-fg-subtle" />
              <Heading level="h3">Address Details</Heading>
            </div>
            <Button
              size="small"
              variant="transparent"
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
          </div>

          {addr ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
                  Address Line 1
                </Text>
                <Text size="small" className="text-ui-fg-base mt-0.5">
                  {addr.address_1 || "-"}
                </Text>
              </div>

              <div>
                <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
                  Address Line 2
                </Text>
                <Text size="small" className="text-ui-fg-base mt-0.5">
                  {addr.address_2 || "-"}
                </Text>
              </div>

              <div>
                <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
                  City & State
                </Text>
                <Text size="small" className="text-ui-fg-base mt-0.5">
                  {[addr.city, addr.province].filter(Boolean).join(", ") || "-"}
                </Text>
              </div>

              <div>
                <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
                  Postal Code
                </Text>
                <Text size="small" className="text-ui-fg-base mt-0.5">
                  {addr.postal_code || "-"}
                </Text>
              </div>

              <div>
                <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
                  Country
                </Text>
                <Text size="small" className="text-ui-fg-base mt-0.5">
                  {addr.country_code?.toUpperCase() || "-"}
                </Text>
              </div>

              <div>
                <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
                  Company
                </Text>
                <Text size="small" className="text-ui-fg-base mt-0.5">
                  {addr.company || "-"}
                </Text>
              </div>
            </div>
          ) : (
            <Text size="small" className="text-ui-fg-subtle py-4 text-center">
              No address configured for this location.
            </Text>
          )}
        </Container>

        {/* Fulfillment Sets / Shipping Options Card */}
        <Container className="p-6 flex flex-col gap-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-x-2">
              <TruckFast className="text-ui-fg-subtle" />
              <Heading level="h3">Fulfillment & Shipping</Heading>
            </div>
          </div>

          <div className="flex flex-col gap-y-3">
            {location.fulfillment_sets && location.fulfillment_sets.length > 0 ? (
              location.fulfillment_sets.map((set: any) => (
                <div
                  key={set.id}
                  className="flex items-center justify-between rounded-lg border p-3 bg-ui-bg-subtle"
                >
                  <div className="flex flex-col">
                    <Text size="small" weight="plus">
                      {set.name}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Type: {set.type}
                    </Text>
                  </div>
                  <Badge size="small">Active</Badge>
                </div>
              ))
            ) : (
              <div className="py-6 text-center">
                <Text size="small" className="text-ui-fg-subtle">
                  Standard vendor fulfillment is enabled for this location.
                </Text>
              </div>
            )}
          </div>
        </Container>

        {/* Connected Sales Channels */}
        <Container className="p-6 flex flex-col gap-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-x-2">
              <Channels className="text-ui-fg-subtle" />
              <Heading level="h3">Connected Sales Channels</Heading>
            </div>
          </div>

          {location.sales_channels && location.sales_channels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {location.sales_channels.map((sc: any) => (
                <div
                  key={sc.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <Text size="small" weight="plus">
                      {sc.name}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {sc.description || "No description"}
                    </Text>
                  </div>
                  <StatusBadge color="green">Connected</StatusBadge>
                </div>
              ))}
            </div>
          ) : (
            <Text size="small" className="text-ui-fg-subtle py-4 text-center">
              This location is accessible to all vendor sales channels.
            </Text>
          )}
        </Container>
      </div>

      <LocationEditDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        location={location}
      />
    </div>
  )
}
