"use client"

import {
  createVendorProvider,
  deleteVendorRecurringAvailability,
  getVendorProviderMe,
  listVendorAppointments,
  listVendorAvailabilityExceptions,
  listVendorRecurringAvailability,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Heading,
  IconButton,
  Input,
  Label,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Section } from "@modules/products/components/detail/section"
import { RecurringAvailabilityCreateModal } from "./forms/recurring-availability-create-modal"
import { ExceptionCreateModal } from "./forms/exception-create-modal"
import { AppointmentCreateModal } from "./forms/appointment-create-modal"

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

const STATUS_BADGE: Record<string, { label: string; color: any }> = {
  available: { label: "Available", color: "grey" },
  booked: { label: "Booked", color: "blue" },
  cancelled: { label: "Cancelled", color: "red" },
  completed: { label: "Completed", color: "green" },
}

const SetUpCalendarPrompt = ({ onCreated }: { onCreated: () => void }) => {
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  )

  const createMutation = useMutation({
    mutationFn: () => createVendorProvider({ timezone }),
    onSuccess: () => {
      toast.success("Provider profile created")
      onCreated()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not create provider profile")
    },
  })

  return (
    <div className="bg-ui-bg-base shadow-elevation-card-rest overflow-hidden rounded-lg p-6 flex flex-col gap-4">
      <div>
        <Heading level="h2">Set up your calendar</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Create your provider profile once to start setting hours and
          generating bookable slots.
        </Text>
      </div>
      <div className="flex flex-col gap-2 max-w-sm">
        <Label size="small" weight="plus">
          Timezone
        </Label>
        <Input
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          placeholder="America/New_York"
        />
      </div>
      <div>
        <Button
          size="small"
          onClick={() => createMutation.mutate()}
          isLoading={createMutation.isPending}
          disabled={!timezone.trim()}
        >
          Create provider profile
        </Button>
      </div>
    </div>
  )
}

export const MySchedule = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [recurringModalOpen, setRecurringModalOpen] = useState(false)
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false)
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false)

  const { data: providerData, isLoading: providerLoading } = useQuery({
    queryKey: ["vendor-provider-me"],
    queryFn: getVendorProviderMe,
  })

  const hasProvider = !!providerData?.provider

  const { data: recurringData, isLoading: recurringLoading } = useQuery({
    queryKey: ["vendor-recurring-availability"],
    queryFn: listVendorRecurringAvailability,
    enabled: hasProvider,
  })

  const { data: exceptionsData, isLoading: exceptionsLoading } = useQuery({
    queryKey: ["vendor-availability-exceptions"],
    queryFn: listVendorAvailabilityExceptions,
    enabled: hasProvider,
  })

  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["vendor-appointments"],
    queryFn: listVendorAppointments,
    enabled: hasProvider,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorRecurringAvailability(id),
    onSuccess: () => {
      toast.success("Recurring hours removed")
      queryClient.invalidateQueries({ queryKey: ["vendor-recurring-availability"] })
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not remove recurring hours")
    },
  })

  const handleDelete = async (id: string) => {
    const confirmed = await prompt({
      title: "Remove recurring hours?",
      description: "Future slots generated from this rule will not be affected.",
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(id)
    }
  }

  if (providerLoading) {
    return (
      <div className="bg-ui-bg-base shadow-elevation-card-rest overflow-hidden rounded-lg p-6">
        <Text size="small" className="text-ui-fg-subtle">
          Loading...
        </Text>
      </div>
    )
  }

  if (!hasProvider) {
    return (
      <SetUpCalendarPrompt
        onCreated={() =>
          queryClient.invalidateQueries({ queryKey: ["vendor-provider-me"] })
        }
      />
    )
  }

  const rules = recurringData?.recurring_availabilities ?? []
  const exceptions = exceptionsData?.availability_exceptions ?? []
  const appointments = appointmentsData?.appointments ?? []

  return (
    <div className="flex flex-col gap-y-4">
      <div>
        <Heading level="h1">My Schedule</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Set your recurring hours, block off days, and see your upcoming
          appointments.
        </Text>
      </div>

      <Section
        title="Weekly hours"
        actions={
          <Button size="small" variant="secondary" onClick={() => setRecurringModalOpen(true)}>
            Add hours
          </Button>
        }
      >
        {recurringLoading ? (
          <div className="px-6 py-8">
            <Text size="small" className="text-ui-fg-subtle">
              Loading...
            </Text>
          </div>
        ) : !rules.length ? (
          <div className="px-6 py-12 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              No recurring hours yet. Add hours to start generating bookable slots.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Day</Table.HeaderCell>
                <Table.HeaderCell>Hours</Table.HeaderCell>
                <Table.HeaderCell>Effective from</Table.HeaderCell>
                <Table.HeaderCell>Effective until</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rules.map((rule) => (
                <Table.Row key={rule.id}>
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {DAY_NAMES[rule.day_of_week]}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall">
                      {rule.start_time} – {rule.end_time}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {new Date(rule.effective_from).toLocaleDateString()}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {rule.effective_until
                        ? new Date(rule.effective_until).toLocaleDateString()
                        : "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <IconButton
                      size="small"
                      variant="transparent"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash />
                    </IconButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Section>

      <Section
        title="Exceptions"
        actions={
          <Button size="small" variant="secondary" onClick={() => setExceptionModalOpen(true)}>
            Add exception
          </Button>
        }
      >
        {exceptionsLoading ? (
          <div className="px-6 py-8">
            <Text size="small" className="text-ui-fg-subtle">
              Loading...
            </Text>
          </div>
        ) : !exceptions.length ? (
          <div className="px-6 py-12 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              No exceptions yet.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell>Type</Table.HeaderCell>
                <Table.HeaderCell>Hours</Table.HeaderCell>
                <Table.HeaderCell>Reason</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {exceptions.map((exception) => (
                <Table.Row key={exception.id}>
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {new Date(exception.date).toLocaleDateString()}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="2xsmall"
                      color={exception.type === "blackout" ? "red" : "green"}
                    >
                      {exception.type === "blackout" ? "Blocked" : "Extra hours"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {exception.start_time && exception.end_time
                        ? `${exception.start_time} – ${exception.end_time}`
                        : "All day"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {exception.reason || "—"}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Section>

      <Section
        title="Appointments"
        action={
          <Button
            size="small"
            variant="secondary"
            onClick={() => setAppointmentModalOpen(true)}
          >
            Add appointment
          </Button>
        }
      >
        {appointmentsLoading ? (
          <div className="px-6 py-8">
            <Text size="small" className="text-ui-fg-subtle">
              Loading...
            </Text>
          </div>
        ) : !appointments.length ? (
          <div className="px-6 py-12 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              No appointments yet.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Service</Table.HeaderCell>
                <Table.HeaderCell>Date/Time</Table.HeaderCell>
                <Table.HeaderCell>Capacity</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {appointments.map((appointment) => {
                const activeAttendees = (appointment.attendees ?? []).filter(
                  (attendee) => attendee.status !== "cancelled"
                ).length

                return (
                  <Table.Row key={appointment.id}>
                    <Table.Cell>
                      <Text size="small" weight="plus">
                        {appointment.service_product?.title ?? "—"}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle">
                        {new Date(appointment.start_time).toLocaleString()} –{" "}
                        {new Date(appointment.end_time).toLocaleTimeString()}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">
                        {activeAttendees} / {appointment.max_capacity}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        size="2xsmall"
                        color={STATUS_BADGE[appointment.status]?.color ?? "grey"}
                      >
                        {STATUS_BADGE[appointment.status]?.label ?? appointment.status}
                      </Badge>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>
        )}
      </Section>

      <RecurringAvailabilityCreateModal
        open={recurringModalOpen}
        onOpenChange={setRecurringModalOpen}
      />
      <ExceptionCreateModal
        open={exceptionModalOpen}
        onOpenChange={setExceptionModalOpen}
      />
      <AppointmentCreateModal
        open={appointmentModalOpen}
        onOpenChange={setAppointmentModalOpen}
      />
    </div>
  )
}

export default MySchedule
