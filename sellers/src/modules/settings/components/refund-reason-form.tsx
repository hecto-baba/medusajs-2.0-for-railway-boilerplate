"use client"

import {
  createVendorRefundReason,
  updateVendorRefundReason,
  type VendorRefundReason,
} from "@lib/data/vendor-client"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Input, Textarea, toast } from "@medusajs/ui"
import { Form, KeyboundForm, RouteDrawer, useRouteModal } from "@modules/common"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import * as zod from "zod"

const RefundReasonSchema = zod.object({
  label: zod.string().min(1, "Label is required."),
  code: zod.string().min(1, "Code is required."),
  description: zod.string().optional(),
})

type RefundReasonFormProps = {
  reason?: VendorRefundReason
}

/** Mirrors return-reason-form.tsx; refund reasons use `code` instead of `value`. */
export const RefundReasonForm = ({ reason }: RefundReasonFormProps) => {
  const isEdit = Boolean(reason)
  const { handleSuccess } = useRouteModal()
  const queryClient = useQueryClient()

  const form = useForm<zod.infer<typeof RefundReasonSchema>>({
    defaultValues: {
      label: reason?.label ?? "",
      code: reason?.code ?? "",
      description: reason?.description ?? "",
    },
    resolver: zodResolver(RefundReasonSchema),
  })

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (values: zod.infer<typeof RefundReasonSchema>) =>
      isEdit
        ? updateVendorRefundReason(reason!.id, {
            label: values.label,
            code: values.code,
            description: values.description?.trim() || null,
          })
        : createVendorRefundReason({
            label: values.label,
            code: values.code,
            description: values.description?.trim() || null,
          }),
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await mutateAsync(values)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the refund reason."
      )
      return
    }

    queryClient.invalidateQueries({ queryKey: ["vendor-refund-reasons"] })
    toast.success(isEdit ? "Refund reason updated" : "Refund reason created")
    handleSuccess()
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <RouteDrawer.Header>
          <RouteDrawer.Title>
            {isEdit ? "Edit refund reason" : "Create refund reason"}
          </RouteDrawer.Title>
        </RouteDrawer.Header>

        <RouteDrawer.Body>
          <div className="flex flex-col gap-y-8">
            <Form.Field
              control={form.control}
              name="label"
              render={({ field }) => (
                <Form.Item>
                  <Form.Label>Label</Form.Label>
                  <Form.Control>
                    <Input {...field} placeholder="Refund" />
                  </Form.Control>
                  <Form.ErrorMessage />
                </Form.Item>
              )}
            />

            <Form.Field
              control={form.control}
              name="code"
              render={({ field }) => (
                <Form.Item>
                  <Form.Label>Code</Form.Label>
                  <Form.Control>
                    <Input {...field} placeholder="refund" />
                  </Form.Control>
                  <Form.ErrorMessage />
                </Form.Item>
              )}
            />

            <Form.Field
              control={form.control}
              name="description"
              render={({ field }) => (
                <Form.Item>
                  <Form.Label optional>Description</Form.Label>
                  <Form.Control>
                    <Textarea {...field} placeholder="Reason description..." />
                  </Form.Control>
                  <Form.ErrorMessage />
                </Form.Item>
              )}
            />
          </div>
        </RouteDrawer.Body>

        <RouteDrawer.Footer>
          <div className="flex items-center gap-x-2">
            <RouteDrawer.Close asChild>
              <Button size="small" variant="secondary">
                Cancel
              </Button>
            </RouteDrawer.Close>
            <Button size="small" type="submit" isLoading={isPending}>
              Save
            </Button>
          </div>
        </RouteDrawer.Footer>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
