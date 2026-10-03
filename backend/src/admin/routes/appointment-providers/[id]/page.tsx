import { PencilSquare, Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { sdk } from "../../../lib/sdk"
import { AppointmentResourceDrawer } from "../../../components/appointment-resource-drawer"
import {
  AppointmentBookingsSection,
  AppointmentPreviewSection,
  AppointmentServicesSection,
} from "../../../components/appointment-resource-sections"
import { CreateRecurringAvailabilityModal } from "../../../components/create-recurring-availability-modal"
import { CreateExceptionModal } from "../../../components/create-exception-modal"
import {
  AvailabilityException,
  AvailabilityExceptionListResponse,
  DAY_NAMES,
  ProviderResponse,
  RecurringAvailabilityListResponse,
} from "../../../types/appointment-booking"

// Effective-from / exception dates are calendar dates stored as UTC midnight.
// Formatting them in the browser's zone shows the previous day west of UTC, so
// they are always rendered in UTC.
const formatCalendarDate = (value: string | Date) =>
  new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" })

const AppointmentProviderDetailPage = () => {
  const { id } = useParams() as { id: string }
  const confirm = usePrompt()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

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

  const deleteExceptionMutation = useMutation({
    mutationFn: (exceptionId: string) =>
      sdk.client.fetch(`/admin/providers/${id}/exceptions/${exceptionId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Exception removed")
      refetchExceptions()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not remove the exception")
    },
  })

  const handleDeleteException = async (exceptionId: string) => {
    if (
      await confirm({
        title: "Remove this exception?",
        description: "The day goes back to the normal weekly hours.",
        variant: "danger",
      })
    ) {
      deleteExceptionMutation.mutate(exceptionId)
    }
  }

  const provider = providerData?.provider
  const rules = recurringData?.recurring_availabilities ?? []
  const [editingException, setEditingException] = useState<AvailabilityException | null>(null)
  const exceptions = exceptionsData?.availability_exceptions ?? []

  const providerName =
    provider?.display_name ||
    provider?.vendor_admin?.email ||
    id

  const toggleStatus = useMutation({
    mutationFn: (status: "active" | "inactive") =>
      sdk.client.fetch(`/admin/providers/${id}`, { method: "POST", body: { status } }),
    onSuccess: () => {
      toast.success("Status updated")
      queryClient.invalidateQueries({ queryKey: [["admin-provider", id]] })
      queryClient.invalidateQueries({ queryKey: [["admin-providers"]] })
    },
    onError: (error: any) => toast.error(error?.message || "Could not change the status"),
  })

  if (!providerLoading && !provider) {
    return (
      <Container className="flex flex-col items-start gap-y-3 px-6 py-6">
        <Text size="small" className="text-ui-fg-error">Resource not found.</Text>
        <Link to="/appointment-providers" className="text-ui-fg-interactive txt-small">
          Back to the list
        </Link>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/appointment-providers" className="text-ui-fg-subtle hover:text-ui-fg-base txt-small">
        &larr; Appointment resources
      </Link>

      <Container className="divide-y p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <div className="flex items-center gap-x-3">
              <Heading level="h1">{providerLoading ? "Loading..." : providerName}</Heading>
              {provider ? (
                provider.status !== "active" ? (
                  <Badge color="grey" size="2xsmall">Inactive</Badge>
                ) : provider.readiness?.live ? (
                  <Badge color="green" size="2xsmall">Live</Badge>
                ) : (
                  <Badge color="orange" size="2xsmall">Needs setup</Badge>
                )
              ) : null}
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              {provider?.vendor?.name ? `${provider.vendor.name} · ` : ""}
              {provider?.timezone ?? ""}
            </Text>
            {provider ? (
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Editing on behalf of the business: changes are visible to the seller.
              </Text>
            ) : null}
          </div>
          {provider ? (
            <div className="flex gap-2">
              <Button size="small" variant="secondary" onClick={() => setEditing(true)}>
                Edit profile &amp; rules
              </Button>
              <Button
                size="small"
                variant="secondary"
                isLoading={toggleStatus.isPending}
                onClick={() => toggleStatus.mutate(provider.status === "active" ? "inactive" : "active")}
              >
                {provider.status === "active" ? "Mark inactive" : "Mark active"}
              </Button>
            </div>
          ) : null}
        </div>
        {provider ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-6 py-4 md:grid-cols-4">
            {[
              ["Session", `${provider.session_duration_minutes} min`],
              ["People per slot", String(provider.capacity)],
              ["Buffer", `${provider.buffer_before_minutes} before · ${provider.buffer_after_minutes} after`],
              ["Minimum notice", `${provider.min_notice_minutes} min`],
              ["Book up to", `${provider.max_advance_days} days ahead`],
              ["Cancel until", `${provider.cancellation_window_hours} h before`],
              ["Checkout hold", `${provider.hold_minutes} min`],
              ["Timezone", provider.timezone],
            ].map(([label, value]) => (
              <div key={label}>
                <Text size="xsmall" className="text-ui-fg-subtle">{label}</Text>
                <Text size="small" weight="plus">{value}</Text>
              </div>
            ))}
          </div>
        ) : null}
        {provider && provider.status === "active" && provider.readiness && !provider.readiness.live ? (
          <div className="bg-ui-bg-subtle px-6 py-3">
            <Text size="small" className="text-ui-fg-subtle">
              Not visible to customers yet: {provider.readiness.missing.join(", ").toLowerCase()}.
            </Text>
          </div>
        ) : null}
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
                      {formatCalendarDate(rule.effective_from)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {rule.effective_until
                        ? formatCalendarDate(rule.effective_until)
                        : "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <IconButton
                      size="small"
                      variant="transparent"
                      aria-label="Remove recurring hours"
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

        {editingException ? (
          <CreateExceptionModal
            key={editingException.id}
            endpoint={`/admin/providers/${id}/exceptions`}
            entry={editingException}
            onClose={() => setEditingException(null)}
            onCreated={refetchExceptions}
          />
        ) : null}
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
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {exceptions.map((exception) => (
                <Table.Row key={exception.id}>
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {formatCalendarDate(exception.date)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="2xsmall"
                      color={
                        exception.type === "extra_hours"
                          ? "green"
                          : exception.start_time && exception.end_time
                            ? "orange"
                            : "red"
                      }
                    >
                      {exception.type === "extra_hours"
                        ? "Extra hours"
                        : exception.start_time && exception.end_time
                          ? "Time off"
                          : "Day off"}
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
                  <Table.Cell className="text-right">
                    <IconButton
                      size="small"
                      variant="transparent"
                      aria-label="Edit exception"
                      onClick={() => setEditingException(exception)}
                    >
                      <PencilSquare />
                    </IconButton>
                    <IconButton
                      size="small"
                      variant="transparent"
                      aria-label="Remove exception"
                      disabled={deleteExceptionMutation.isPending}
                      onClick={() => handleDeleteException(exception.id)}
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

      {provider ? (
        <>
          <AppointmentServicesSection resource={provider} />
          <AppointmentPreviewSection resource={provider} />
          <AppointmentBookingsSection resource={provider} />
        </>
      ) : null}

      {provider ? (
        <AppointmentResourceDrawer
          open={editing}
          onOpenChange={setEditing}
          resource={provider}
        />
      ) : null}
    </div>
  )
}

// A dynamic route cannot appear in the sidebar, so it carries no route config;
// the list page is reached from the "Appointment Providers" sidebar entry
// (routes/booking/appointment-providers/page.tsx).
export default AppointmentProviderDetailPage
