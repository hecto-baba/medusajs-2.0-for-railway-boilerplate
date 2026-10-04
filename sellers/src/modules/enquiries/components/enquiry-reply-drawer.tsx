"use client"

import {
  closeVendorEnquiry,
  getVendorEnquiry,
  replyToVendorEnquiry,
  type VendorEnquiryStatus,
} from "@lib/data/vendor-client"
import { Badge, Button, Drawer, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

export const ENQUIRY_STATUS_COLOR: Record<VendorEnquiryStatus, "orange" | "green" | "grey"> = {
  pending: "orange",
  responded: "green",
  closed: "grey",
}

export const ENQUIRY_STATUS_LABEL: Record<VendorEnquiryStatus, string> = {
  pending: "Pending",
  responded: "Responded",
  closed: "Closed",
}

export const formatEnquiryDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

/**
 * Read, reply to or close one enquiry. Shared by the product page section and
 * the Enquiries page. Loads the full enquiry by id (the queue list omits the
 * custom-field answers), and labels answers from custom_fields_snapshot - the
 * fields as they were when the customer submitted, not today's configuration.
 */
export const EnquiryReplyDrawer = ({
  enquiryId,
  onClose,
  onChanged,
}: {
  enquiryId: string | null
  onClose: () => void
  /** Called after a reply or close, so the caller can refresh its list. */
  onChanged: () => void
}) => {
  const queryClient = useQueryClient()
  const [reply, setReply] = useState("")

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vendor-enquiry", enquiryId],
    queryFn: () => getVendorEnquiry(enquiryId as string),
    enabled: !!enquiryId,
    retry: false,
  })

  const enquiry = data?.enquiry

  useEffect(() => {
    setReply(enquiry?.reply ?? "")
  }, [enquiry?.id, enquiry?.reply])

  const done = () => {
    // Drop the cached copy so reopening this enquiry shows its new status
    // instead of the pre-reply one.
    queryClient.invalidateQueries({ queryKey: ["vendor-enquiry", enquiryId] })
    onChanged()
    onClose()
  }

  const replyMutation = useMutation({
    mutationFn: (text: string) => replyToVendorEnquiry(enquiryId as string, text),
    onSuccess: () => {
      toast.success("Reply sent")
      done()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to send reply"),
  })

  const closeMutation = useMutation({
    mutationFn: () => closeVendorEnquiry(enquiryId as string),
    onSuccess: () => {
      toast.success("Enquiry closed")
      done()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to close enquiry"),
  })

  const fields = (enquiry?.custom_fields_snapshot ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
  const answers = enquiry?.custom_field_answers ?? {}
  const isPending = enquiry?.status === "pending"

  return (
    <Drawer open={!!enquiryId} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Enquiry</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          {isLoading && <Text className="text-ui-fg-subtle">Loading...</Text>}
          {isError && (
            <Text className="text-ui-fg-error">Could not load this enquiry.</Text>
          )}

          {enquiry && (
            <>
              <div className="flex flex-col gap-y-1">
                <div className="flex items-center gap-x-2">
                  <Text size="small" weight="plus">
                    {enquiry.customer_email}
                  </Text>
                  <Badge size="2xsmall" color={ENQUIRY_STATUS_COLOR[enquiry.status]}>
                    {ENQUIRY_STATUS_LABEL[enquiry.status]}
                  </Badge>
                </div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {enquiry.product?.title ? `${enquiry.product.title} · ` : ""}
                  {formatEnquiryDate(enquiry.created_at)}
                </Text>
              </div>

              <div className="flex flex-col gap-y-1">
                <Text size="small" weight="plus" className="text-ui-fg-subtle">
                  Question
                </Text>
                <Text size="small" className="whitespace-pre-wrap">
                  {enquiry.message}
                </Text>
              </div>

              {fields.map((field) => {
                const answer = answers[field.id]
                if (answer === undefined || answer === null || answer === "") return null
                return (
                  <div key={field.id} className="flex flex-col gap-y-0.5">
                    <Text size="small" weight="plus" className="text-ui-fg-subtle">
                      {field.label}
                    </Text>
                    <Text size="small">
                      {Array.isArray(answer) ? answer.join(", ") : answer}
                    </Text>
                  </div>
                )
              })}

              <hr className="border-ui-border-base" />

              {enquiry.status === "responded" && (
                <div className="flex flex-col gap-y-1">
                  <Text size="small" weight="plus" className="text-ui-fg-subtle">
                    Your reply
                  </Text>
                  <Text size="small" className="whitespace-pre-wrap">
                    {enquiry.reply}
                  </Text>
                </div>
              )}

              {enquiry.status === "closed" && (
                <Text size="small" className="text-ui-fg-subtle">
                  This enquiry was closed without a reply.
                </Text>
              )}

              {isPending && (
                <div className="flex flex-col gap-y-1">
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
          {isPending && (
            <Button
              variant="secondary"
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending || replyMutation.isPending}
              isLoading={closeMutation.isPending}
            >
              Close without replying
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {isPending ? "Cancel" : "Done"}
          </Button>
          {isPending && (
            <Button
              onClick={() => replyMutation.mutate(reply.trim())}
              disabled={replyMutation.isPending || closeMutation.isPending || !reply.trim()}
              isLoading={replyMutation.isPending}
            >
              Send reply
            </Button>
          )}
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
