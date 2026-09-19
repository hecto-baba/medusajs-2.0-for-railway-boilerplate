"use client"

import {
  createVendorAppointmentSlots,
  getVendorProviderMe,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Input,
  Label,
  StatusBadge,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Row, Section } from "./section"

/**
 * Lets a seller mark one of their own products as a bookable service and
 * generate slots for it, mirroring the admin's product-appointment-config
 * widget. Unlike the admin version there's no provider picker here - the
 * seller only ever books slots against their own calendar.
 */
export const AppointmentSection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState("30")
  const [dateFrom, setDateFrom] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [dateTo, setDateTo] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )

  const { data: providerData, isLoading: providerLoading } = useQuery({
    queryKey: ["vendor-provider-me"],
    queryFn: getVendorProviderMe,
  })

  const hasProvider = !!providerData?.provider

  const generateMutation = useMutation({
    mutationFn: () =>
      createVendorAppointmentSlots({
        service_product_id: product.id,
        service_duration_minutes: Number(durationMinutes),
        date_from: `${dateFrom}T00:00:00.000Z`,
        date_to: `${dateTo}T00:00:00.000Z`,
      }),
    onSuccess: (data) => {
      toast.success(
        `${data.appointments.length} slot(s) generated for this service`
      )
      queryClient.invalidateQueries({ queryKey: ["vendor-appointments"] })
      setOpen(false)
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not generate slots")
    },
  })

  const onGenerate = () => {
    const duration = Number(durationMinutes)

    if (!Number.isInteger(duration) || duration < 1) {
      toast.error("Duration must be a whole number of minutes.")
      return
    }

    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      toast.error("Pick a valid date range to generate slots for.")
      return
    }

    generateMutation.mutate()
  }

  if (providerLoading) {
    return (
      <Section title="Appointment Booking">
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-muted">
            Loading…
          </Text>
        </div>
      </Section>
    )
  }

  if (!hasProvider) {
    return (
      <Section title="Appointment Booking">
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-muted">
            Set up your calendar under &ldquo;My Schedule&rdquo; first to make
            this product bookable.
          </Text>
        </div>
      </Section>
    )
  }

  return (
    <Section
      title="Appointment Booking"
      actions={<StatusBadge color="green">Bookable</StatusBadge>}
    >
      <Row label="Duration">
        This service uses whatever duration you set when generating slots
        below.
      </Row>
      <div className="flex items-center justify-end px-6 py-4">
        <Button size="small" variant="secondary" onClick={() => setOpen(true)}>
          Generate slots
        </Button>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Generate appointment slots</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="duration-minutes">
                Duration (minutes)
              </Label>
              <Input
                id="duration-minutes"
                type="number"
                min="1"
                step="1"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="date-from">
                From
              </Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="date-to">
                To
              </Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
            <Text size="xsmall" className="text-ui-fg-muted">
              Slots are generated from your recurring hours (set under
              &ldquo;My Schedule&rdquo;), minus any blackout dates.
            </Text>
          </Drawer.Body>
          <Drawer.Footer>
            <Button size="small" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="small"
              onClick={onGenerate}
              isLoading={generateMutation.isPending}
            >
              Generate
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Section>
  )
}

export default AppointmentSection
