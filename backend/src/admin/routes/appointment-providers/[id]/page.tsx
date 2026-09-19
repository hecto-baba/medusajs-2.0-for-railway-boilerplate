import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Calendar } from "@medusajs/icons"
import { Trash } from "@medusajs/icons"
import {
  Badge,
  Container,
  Heading,
  IconButton,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { sdk } from "../../../lib/sdk"
import { CreateRecurringAvailabilityModal } from "../../../components/create-recurring-availability-modal"
import { CreateExceptionModal } from "../../../components/create-exception-modal"
import {
  AppointmentListResponse,
  AvailabilityExceptionListResponse,
  DAY_NAMES,
  ProviderResponse,
  RecurringAvailabilityListResponse,
} from "../../../types/appointment-booking"

const STATUS_BADGE: Record<string, { label: string; color: any }> = {
  available: { label: "Available", color: "grey" },
  booked: { label: "Booked", color: "blue" },
  cancelled: { label: "Cancelled", color: "red" },
  completed: { label: "Completed", color: "green" },
}

const AppointmentProviderDetailPage = () => {
  const { id } = useParams() as { id: string }
  const confirm = usePrompt()

  const { data: providerData, isLoading: providerLoading } = useQuery<ProviderResponse>({
    queryFn: () => sdk.client.fetch(`/admin/providers/${id}`),
    queryKey: [["admin-provider", id]],
  })

  const {
    data: recurringData,
    isLoading: recurringLoading,
    refetch: refetchRecurring,
  } = useQuery<RecurringAvailabilityListResponse>({
    queryFn: () =>
      sdk.client.fetch(`/admin/providers/${id}/recurring-availability`),
    queryKey: [["admin-provider-recurring-availability", id]],
  })

  const {
    data: exceptionsData,
    isLoading: exceptionsLoading,
    refetch: refetchExceptions,
  } = useQuery<AvailabilityExceptionListResponse>({
    queryFn: () => sdk.client.fetch(`/admin/providers/${id}/exceptions`),
    queryKey: [["admin-provider-exceptions", id]],
  })

  const { data: appointmentsData, isLoading: appointmentsLoading } =
    useQuery<AppointmentListResponse>({
      queryFn: () => sdk.client.fetch(`/admin/providers/${id}/appointments`),
      queryKey: [["admin-provider-appointments", id]],
    })

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) =>
      sdk.client.fetch(
        `/admin/providers/${id}/recurring-availability/${ruleId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      toast.success("Recurring hours removed")
      refetchRecurring()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not remove recurring hours")
    },
  })

  const handleDelete = async (ruleId: string) => {
    if (
      await confirm({
        title: "Remove recurring hours?",
        description: "Future slots generated from this rule will not be affected.",
        variant: "danger",
      })
    ) {
      deleteMutation.mutate(ruleId)
    }
  }

  const provider = providerData?.provider
  const rules = recurringData?.recurring_availabilities ?? []
  const exceptions = exceptionsData?.availability_exceptions ?? []
  const appointments = appointmentsData?.appointments ?? []

  const providerName =
    provider?.display_name ||
    (provider as any)?.vendor_admin?.email ||
    id

  return (
    <div className="flex flex-col gap-6">
      <Container className="px-6 py-4">
        <Heading level="h1">{providerLoading ? "Loading..." : providerName}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {provider?.timezone ? `Timezone: ${provider.timezone}` : ""}
        </Text>
      </Container>

      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h2">Weekly hours</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Recurring hours this provider is available, repeated every week
            </Text>
          </div>
          <CreateRecurringAvailabilityModal
            endpoint={`/admin/providers/${id}/recurring-availability`}
            onCreated={refetchRecurring}
          />
        </div>

        {recurringLoading ? (
          <div className="px-6 py-8">
            <Text size="small" className="text-ui-fg-subtle">
              Loading...
            </Text>
          </div>
        ) : !rules.length ? (
          <div className="px-6 py-12 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              No recurring hours yet.
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
      </Container>

      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h2">Exceptions</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              One-off overrides for specific dates - holidays or extra hours
            </Text>
          </div>
          <CreateExceptionModal
            endpoint={`/admin/providers/${id}/exceptions`}
            onCreated={refetchExceptions}
          />
        </div>

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
      </Container>

      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h2">Appointments</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Every slot on this provider's calendar, booked or open
            </Text>
          </div>
        </div>

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
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Appointment Provider",
  icon: Calendar,
})

export default AppointmentProviderDetailPage
