"use client"

import {
  copyVendorResourceSettings,
  deleteVendorResource,
  getVendorResource,
  listVendorResources,
  updateVendorResource,
  type VendorResource,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  FocusModal,
  Heading,
  Label,
  Tabs,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { HolidaysTab } from "./holidays-tab"
import { HoursTab } from "./hours-tab"
import { PreviewTab } from "./preview-tab"
import { ResourceFormDrawer } from "./resource-form-drawer"
import { ServicesTab } from "./services-tab"

const Summary = ({ r }: { r: VendorResource }) => (
  <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-6 py-4 md:grid-cols-4">
    {[
      ["Session", `${r.session_duration_minutes} min`],
      ["People per slot", String(r.capacity)],
      ["Buffer", `${r.buffer_before_minutes} before · ${r.buffer_after_minutes} after`],
      ["Minimum notice", `${r.min_notice_minutes} min`],
      ["Book up to", `${r.max_advance_days} days ahead`],
      ["Cancel until", `${r.cancellation_window_hours} h before`],
      ["Checkout hold", `${r.hold_minutes} min`],
      ["Timezone", r.timezone],
    ].map(([label, value]) => (
      <div key={label}>
        <Text size="xsmall" className="text-ui-fg-subtle">{label}</Text>
        <Text size="small" weight="plus">{value}</Text>
      </div>
    ))}
  </div>
)

const CopySettingsModal = ({
  source,
  open,
  onOpenChange,
}: {
  source: VendorResource
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const [selected, setSelected] = useState<string[]>([])
  const { data } = useQuery({
    queryKey: ["vendor-resources"],
    queryFn: listVendorResources,
    enabled: open,
  })
  const others = (data?.resources ?? []).filter((r) => r.id !== source.id)

  const copy = useMutation({
    mutationFn: () => copyVendorResourceSettings(source.id, selected),
    onSuccess: ({ updated }) => {
      toast.success(`Settings copied to ${updated.length} resource(s)`)
      setSelected([])
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.message || "Could not copy settings"),
  })

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>Copy booking rules</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-8">
          <div className="flex w-full max-w-lg flex-col gap-y-4">
            <Text size="small" className="text-ui-fg-subtle">
              Copies session length, slot step, people per slot, buffers, notice, booking
              horizon, hold time and cancellation window from {source.display_name} to the
              resources you choose. Hours, holidays, services and existing bookings are not
              changed.
            </Text>
            {others.length ? (
              others.map((r) => (
                <div key={r.id} className="flex items-center gap-x-2">
                  <Checkbox
                    id={`copy-${r.id}`}
                    checked={selected.includes(r.id)}
                    onCheckedChange={(checked) =>
                      setSelected((cur) => (checked === true ? [...cur, r.id] : cur.filter((x) => x !== r.id)))
                    }
                  />
                  <Label htmlFor={`copy-${r.id}`} className="font-normal">
                    {r.display_name}
                  </Label>
                </div>
              ))
            ) : (
              <Text size="small" className="text-ui-fg-muted">You have no other resources yet.</Text>
            )}
          </div>
        </FocusModal.Body>
        <FocusModal.Footer>
          <div className="flex gap-x-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => copy.mutate()} disabled={!selected.length || copy.isPending} isLoading={copy.isPending}>
              Copy
            </Button>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}

export const ResourceDetail = ({ id }: { id: string }) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [editing, setEditing] = useState(false)
  const [copying, setCopying] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vendor-resource", id],
    queryFn: () => getVendorResource(id),
  })

  const resource = data?.resource

  const toggleActive = useMutation({
    mutationFn: (status: "active" | "inactive") => updateVendorResource(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-resource", id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-resources"] })
    },
    onError: (e: any) => toast.error(e?.message || "Could not change the status"),
  })

  const remove = useMutation({
    mutationFn: () => deleteVendorResource(id),
    onSuccess: () => {
      toast.success("Resource deleted")
      queryClient.invalidateQueries({ queryKey: ["vendor-resources"] })
      router.push("/appointments/resources")
    },
    onError: (e: any) => toast.error(e?.message || "Could not delete the resource"),
  })

  const confirmDelete = async () => {
    const ok = await prompt({
      title: "Delete this resource?",
      description:
        "Customers will no longer be able to book it. This is refused while it has upcoming bookings; cancel those first, or mark it inactive instead.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (ok) remove.mutate()
  }

  if (isLoading) {
    return (
      <Container className="p-6">
        <Text size="small" className="text-ui-fg-subtle">Loading...</Text>
      </Container>
    )
  }

  if (isError || !resource) {
    return (
      <Container className="flex flex-col items-start gap-y-3 p-6">
        <Text size="small" className="text-ui-fg-error">
          {(error as Error)?.message || "Resource not found."}
        </Text>
        <Link href="/appointments/resources" className="text-ui-fg-interactive txt-small">
          Back to resources
        </Link>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Link href="/appointments/resources" className="text-ui-fg-subtle hover:text-ui-fg-base txt-small">
        &larr; Resources
      </Link>

      <Container className="divide-y p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-x-3">
            <Heading level="h1">{resource.display_name || "Untitled"}</Heading>
            {resource.status !== "active" ? (
              <Badge color="grey" size="2xsmall">Inactive</Badge>
            ) : resource.readiness?.live ? (
              <Badge color="green" size="2xsmall">Live</Badge>
            ) : (
              <Badge color="orange" size="2xsmall">Needs setup</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" onClick={() => setEditing(true)}>
              Edit profile &amp; rules
            </Button>
            <Button size="small" variant="secondary" onClick={() => setCopying(true)}>
              Copy rules
            </Button>
            <Button
              size="small"
              variant="secondary"
              isLoading={toggleActive.isPending}
              onClick={() => toggleActive.mutate(resource.status === "active" ? "inactive" : "active")}
            >
              {resource.status === "active" ? "Mark inactive" : "Mark active"}
            </Button>
            <Button size="small" variant="danger" onClick={confirmDelete} isLoading={remove.isPending}>
              Delete
            </Button>
          </div>
        </div>

        {resource.status === "active" && resource.readiness && !resource.readiness.live ? (
          <div className="bg-ui-bg-subtle px-6 py-3">
            <Text size="small" className="text-ui-fg-subtle">
              Not visible to customers yet: {resource.readiness.missing.join(", ").toLowerCase()}.
            </Text>
          </div>
        ) : null}

        <Summary r={resource} />
      </Container>

      <Tabs defaultValue="hours">
        <Tabs.List>
          <Tabs.Trigger value="hours">Weekly hours</Tabs.Trigger>
          <Tabs.Trigger value="holidays">Holidays</Tabs.Trigger>
          <Tabs.Trigger value="services">Services</Tabs.Trigger>
          <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
        </Tabs.List>
        <div className="mt-4">
          <Tabs.Content value="hours"><HoursTab resource={resource} /></Tabs.Content>
          <Tabs.Content value="holidays"><HolidaysTab resource={resource} /></Tabs.Content>
          <Tabs.Content value="services"><ServicesTab resource={resource} /></Tabs.Content>
          <Tabs.Content value="preview"><PreviewTab resource={resource} /></Tabs.Content>
        </div>
      </Tabs>

      <ResourceFormDrawer open={editing} onOpenChange={setEditing} resource={resource} />
      <CopySettingsModal source={resource} open={copying} onOpenChange={setCopying} />
    </div>
  )
}
