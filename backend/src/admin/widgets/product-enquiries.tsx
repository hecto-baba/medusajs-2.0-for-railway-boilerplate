import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Button,
  Drawer,
  Textarea,
  Badge,
  toast,
} from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { useState } from "react"
import {
  EnquiryFieldBuilder,
  EnquiryFieldDefinition,
} from "../components/enquiry-field-builder"

type EnquiryStatus = "pending" | "responded" | "closed"

type Enquiry = {
  id: string
  product_id: string
  customer_email: string
  message: string
  reply: string | null
  status: EnquiryStatus
  responded_at: string | null
  created_at: string
  custom_field_answers: Record<string, string | string[]> | null
  custom_fields_snapshot: EnquiryFieldDefinition[] | null
}

type EnquiriesResponse = {
  enquiries: Enquiry[]
  count: number
}

type EnquiryConfig = {
  id: string
  product_id: string
  status: "active" | "inactive"
  custom_fields: EnquiryFieldDefinition[] | null
}

type EnquiryConfigResponse = {
  enquiry_config: EnquiryConfig | null
}

// Stable reference: a fresh `[]` each render makes the field builder's reset
// effect fire on every parent re-render and wipe in-progress edits.
const NO_FIELDS: EnquiryFieldDefinition[] = []

const STATUS_COLOR: Record<EnquiryStatus, "orange" | "green" | "grey"> = {
  pending: "orange",
  responded: "green",
  closed: "grey",
}

const STATUS_LABEL: Record<EnquiryStatus, string> = {
  pending: "Pending",
  responded: "Responded",
  closed: "Closed",
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

// Renders a custom field's answer next to the label captured at submission
// time (custom_fields_snapshot), not the product's current configuration -
// see enquiry.ts model comment on why this is a snapshot, not a live lookup.
const AnswersList = ({ enquiry }: { enquiry: Enquiry }) => {
  const fields = enquiry.custom_fields_snapshot ?? []
  const answers = enquiry.custom_field_answers ?? {}

  if (!fields.length) return null

  return (
    <div className="space-y-2">
      {fields
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((field) => {
          const answer = answers[field.id]
          if (answer === undefined || answer === null) return null

          return (
            <div key={field.id} className="space-y-0.5">
              <Text size="small" weight="plus" className="text-ui-fg-subtle">
                {field.label}
              </Text>
              <Text size="small">
                {Array.isArray(answer) ? answer.join(", ") : answer}
              </Text>
            </div>
          )
        })}
    </div>
  )
}

const ProductEnquiriesWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const [activeEnquiry, setActiveEnquiry] = useState<Enquiry | null>(null)
  const [reply, setReply] = useState("")
  const [builderOpen, setBuilderOpen] = useState(false)
  const queryClient = useQueryClient()

  const displayQueryKey = ["products", product.id, "enquiries"]
  const configQueryKey = ["products", product.id, "enquiry-config"]

  // Display queries: both load on mount, no `enabled` condition - the
  // widget must show its enabled state and list on a plain page refresh,
  // not only after an interaction.
  const { data, isLoading } = useQuery<EnquiriesResponse>({
    queryFn: () => sdk.client.fetch(`/admin/products/${product.id}/enquiries`),
    queryKey: displayQueryKey,
  })

  const { data: configData, isLoading: isConfigLoading } = useQuery<EnquiryConfigResponse>({
    queryFn: () => sdk.client.fetch(`/admin/products/${product.id}/enquiry-config`),
    queryKey: configQueryKey,
  })

  const upsertConfigMutation = useMutation({
    mutationFn: async (body: {
      status?: "active" | "inactive"
      custom_fields?: EnquiryFieldDefinition[]
    }) => {
      return sdk.client.fetch(`/admin/products/${product.id}/enquiry-config`, {
        method: "POST",
        body,
      })
    },
    onSuccess: () => {
      toast.success("Enquiry settings saved")
      queryClient.invalidateQueries({ queryKey: configQueryKey })
      setBuilderOpen(false)
    },
    onError: () => {
      toast.error("Failed to save enquiry settings")
    },
  })

  const replyMutation = useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      return sdk.client.fetch(`/admin/enquiries/${id}`, {
        method: "POST",
        body: { reply },
      })
    },
    onSuccess: () => {
      toast.success("Reply sent")
      queryClient.invalidateQueries({ queryKey: displayQueryKey })
      setActiveEnquiry(null)
      setReply("")
    },
    onError: () => {
      toast.error("Failed to send reply")
    },
  })

  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      return sdk.client.fetch(`/admin/enquiries/${id}/status`, {
        method: "POST",
        body: { status: "closed" },
      })
    },
    onSuccess: () => {
      toast.success("Enquiry closed")
      queryClient.invalidateQueries({ queryKey: displayQueryKey })
    },
    onError: () => {
      toast.error("Failed to close enquiry")
    },
  })

  const handleOpen = (enquiry: Enquiry) => {
    setActiveEnquiry(enquiry)
    setReply(enquiry.reply ?? "")
  }

  const handleSubmitReply = () => {
    if (!activeEnquiry || !reply.trim()) return
    replyMutation.mutate({ id: activeEnquiry.id, reply: reply.trim() })
  }

  const enquiries = data?.enquiries ?? []
  const config = configData?.enquiry_config
  const isEnabled = config?.status === "active"
  const isLoadingAny = isLoading || isConfigLoading

  const handleSaveFields = (fields: EnquiryFieldDefinition[]) => {
    upsertConfigMutation.mutate({
      status: "active",
      custom_fields: fields,
    })
  }

  const handleDisable = () => {
    upsertConfigMutation.mutate({ status: "inactive" })
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Enquiries</Heading>
          <div className="flex items-center gap-2">
            {!isLoadingAny && isEnabled && enquiries.length > 0 && (
              <Badge size="2xsmall">{enquiries.length}</Badge>
            )}
            {!isLoadingAny && (
              <Badge color={isEnabled ? "green" : "grey"} size="2xsmall">
                {isEnabled ? "Active" : "Inactive"}
              </Badge>
            )}
          </div>
        </div>

        {isLoadingAny && (
          <div className="px-6 py-4">
            <Text className="text-ui-fg-subtle">Loading...</Text>
          </div>
        )}

        {!isLoadingAny && !isEnabled && (
          <>
            <div className="px-6 py-4">
              <Text className="text-ui-fg-subtle">
                This product is not currently accepting enquiries.
              </Text>
            </div>
            <div className="flex justify-end border-t px-6 py-4">
              <Button size="small" variant="secondary" onClick={() => setBuilderOpen(true)}>
                Enable Enquiries
              </Button>
            </div>
          </>
        )}

        {!isLoadingAny && isEnabled && (
          <>
            {enquiries.length === 0 && (
              <div className="px-6 py-4">
                <Text className="text-ui-fg-subtle">
                  No enquiries yet for this product.
                </Text>
              </div>
            )}

            {enquiries.map((enquiry) => (
              <div
                key={enquiry.id}
                className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer hover:bg-ui-bg-subtle-hover"
                onClick={() => handleOpen(enquiry)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Text size="small" weight="plus">
                      {enquiry.customer_email}
                    </Text>
                    <Badge size="2xsmall" color={STATUS_COLOR[enquiry.status]}>
                      {STATUS_LABEL[enquiry.status]}
                    </Badge>
                  </div>
                  <Text size="small" className="text-ui-fg-subtle truncate">
                    {enquiry.message}
                  </Text>
                </div>
                <Text size="xsmall" className="text-ui-fg-subtle shrink-0">
                  {formatDate(enquiry.created_at)}
                </Text>
              </div>
            ))}

            <div className="flex gap-2 justify-end px-6 py-4">
              <Button
                size="small"
                variant="secondary"
                onClick={handleDisable}
                disabled={upsertConfigMutation.isPending}
                isLoading={upsertConfigMutation.isPending}
              >
                Disable
              </Button>
              <Button size="small" variant="secondary" onClick={() => setBuilderOpen(true)}>
                Edit fields
              </Button>
            </div>
          </>
        )}
      </Container>

      <EnquiryFieldBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initialFields={config?.custom_fields ?? NO_FIELDS}
        isEnabling={!isEnabled}
        isSaving={upsertConfigMutation.isPending}
        onSave={handleSaveFields}
      />

      <Drawer
        open={!!activeEnquiry}
        onOpenChange={(open) => !open && setActiveEnquiry(null)}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Enquiry</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="space-y-4">
            {activeEnquiry && (
              <>
                <div className="space-y-1">
                  <Text size="small" weight="plus">
                    {activeEnquiry.customer_email}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {formatDate(activeEnquiry.created_at)}
                  </Text>
                </div>

                <div className="space-y-1">
                  <Text size="small" weight="plus" className="text-ui-fg-subtle">
                    Question
                  </Text>
                  <Text size="small">{activeEnquiry.message}</Text>
                </div>

                <AnswersList enquiry={activeEnquiry} />

                <hr />

                {activeEnquiry.status === "responded" ? (
                  <div className="space-y-1">
                    <Text size="small" weight="plus" className="text-ui-fg-subtle">
                      Your reply
                    </Text>
                    <Text size="small">{activeEnquiry.reply}</Text>
                  </div>
                ) : activeEnquiry.status === "closed" ? (
                  <Text size="small" className="text-ui-fg-subtle">
                    This enquiry was closed without a reply.
                  </Text>
                ) : (
                  <div className="space-y-1">
                    <Text size="small" weight="plus" className="text-ui-fg-subtle">
                      Reply
                    </Text>
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Write a reply to the customer..."
                      rows={4}
                    />
                  </div>
                )}
              </>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex gap-2">
              {activeEnquiry?.status === "pending" && (
                <Button
                  variant="secondary"
                  onClick={() => closeMutation.mutate(activeEnquiry.id)}
                  disabled={closeMutation.isPending}
                  isLoading={closeMutation.isPending}
                >
                  Close without replying
                </Button>
              )}
              <Button variant="secondary" onClick={() => setActiveEnquiry(null)}>
                {activeEnquiry?.status === "pending" ? "Cancel" : "Done"}
              </Button>
              {activeEnquiry?.status === "pending" && (
                <Button
                  onClick={handleSubmitReply}
                  disabled={replyMutation.isPending || !reply.trim()}
                  isLoading={replyMutation.isPending}
                >
                  Send reply
                </Button>
              )}
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details",
})

export default ProductEnquiriesWidget
