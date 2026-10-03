"use client"

import { listVendorResources, type VendorResource } from "@lib/data/vendor-client"
import { Badge, Button, Container, Heading, Table, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ResourceFormDrawer } from "./resource-form-drawer"

const StatusBadge = ({ resource }: { resource: VendorResource }) => {
  if (resource.status !== "active") {
    return <Badge color="grey" size="2xsmall">Inactive</Badge>
  }
  if (resource.readiness?.live) {
    return <Badge color="green" size="2xsmall">Live</Badge>
  }
  return (
    <div className="flex flex-col gap-y-0.5">
      <Badge color="orange" size="2xsmall">Needs setup</Badge>
      <Text size="xsmall" className="text-ui-fg-subtle">
        {(resource.readiness?.missing ?? []).join(" · ")}
      </Text>
    </div>
  )
}

export const ResourcesList = () => {
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["vendor-resources"],
    queryFn: listVendorResources,
  })

  const resources = data?.resources ?? []

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Resources</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Everyone and everything customers can book: staff, rooms, equipment. Each
              has its own calendar, hours and booking rules.
            </Text>
          </div>
          <Button size="small" onClick={() => setDrawerOpen(true)}>
            Add resource
          </Button>
        </div>

        {isLoading ? (
          <div className="px-6 py-8">
            <Text size="small" className="text-ui-fg-subtle">Loading...</Text>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-start gap-y-2 px-6 py-8">
            <Text size="small" className="text-ui-fg-error">
              {(error as Error)?.message || "Could not load resources."}
            </Text>
            <Button size="small" variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : !resources.length ? (
          <div className="flex flex-col items-center gap-y-3 px-6 py-12 text-center">
            <Heading level="h2">Set up your first resource</Heading>
            <Text size="small" className="text-ui-fg-subtle max-w-md">
              A resource is who or what a customer books, like a stylist or a room. Add
              one, give it weekly hours and a service, and it becomes bookable.
            </Text>
            <Button size="small" onClick={() => setDrawerOpen(true)}>
              Add resource
            </Button>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Kind</Table.HeaderCell>
                <Table.HeaderCell>Timezone</Table.HeaderCell>
                <Table.HeaderCell>Session</Table.HeaderCell>
                <Table.HeaderCell>People</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {resources.map((resource) => (
                <Table.Row
                  key={resource.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/appointments/resources/${resource.id}`)}
                >
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {resource.display_name || "Untitled"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell className="capitalize">{resource.kind}</Table.Cell>
                  <Table.Cell>{resource.timezone}</Table.Cell>
                  <Table.Cell>{resource.session_duration_minutes} min</Table.Cell>
                  <Table.Cell>{resource.capacity}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge resource={resource} />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>

      <ResourceFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSaved={(saved) => router.push(`/appointments/resources/${saved.id}`)}
      />
    </div>
  )
}
