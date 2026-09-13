"use client"

import {
  createVendorReturnReason,
  updateVendorReturnReason,
  type VendorReturnReason,
} from "@lib/data/vendor-client"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Input, Textarea, toast } from "@medusajs/ui"
import { Form, KeyboundForm, RouteDrawer, useRouteModal } from "@modules/common"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import * as zod from "zod"

const ReturnReasonSchema = zod.object({
  value: zod.string().min(1, "Value is required."),
  label: zod.string().min(1, "Label is required."),
  description: zod.string().optional(),
})

type ReturnReasonFormProps = {
  reason?: VendorReturnReason
}

/**
 * Create/edit in one component, `isEdit = Boolean(reason)` - same convention
 * as product-form.tsx. `value` is the reason's stable code (e.g. "wrong_size")
 * and is only ever set on create: the admin's own validator has no update
 * path for it either, since changing it would silently redefine what
 * existing returns using it mean.
 */
export const ReturnReasonForm = ({ reason }: ReturnReasonFormProps) => {
  const isEdit = Boolean(reason)
  const { handleSuccess } = useRouteModal()
  const queryClient = useQueryClient()

  const form = useForm<zod.infer<typeof ReturnReasonSchema>>({
    defaultValues: {
      value: reason?.value ?? "",
      label: reason?.label ?? "",
      description: reason?.description ?? "",
    },
    resolver: zodResolver(ReturnReasonSchema),
  })

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (values: zod.infer<typeof ReturnReasonSchema>) =>
      isEdit
        ? updateVendorReturnReason(reason!.id, {
            label: values.label,
            description: values.description || null,
          })
        : createVendorReturnReason(values),
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await mutateAsync(values)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the return reason."
      )
      return
    }

    queryClient.invalidateQueries({ queryKey: ["vendor-return-reasons"] })
    toast.success(isEdit ? "Return reason updated" : "Return reason created")
    handleSuccess()
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <RouteDrawer.Header>
          <RouteDrawer.Title>
            {isEdit ? "Edit return reason" : "Create return reason"}
          </RouteDrawer.Title>
        </RouteDrawer.Header>

        <RouteDrawer.Body>
          <div className="flex flex-col gap-y-8">
            <Form.Field
              control={form.control}
              name="value"
              render={({ field }) => (
                <Form.Item>
                  <Form.Label>Value</Form.Label>
                  <Form.Control>
                    <Input {...field} disabled={isEdit} placeholder="wrong_size" />
                  </Form.Control>
                  {isEdit && (
                    <Form.Hint>
                      The value cannot be changed once a return reason is created.
                    </Form.Hint>
                  )}
                  <Form.ErrorMessage />
                </Form.Item>
              )}
            />

            <Form.Field
              control={form.control}
              name="label"
              render={({ field }) => (
                <Form.Item>
                  <Form.Label>Label</Form.Label>
                  <Form.Control>
                    <Input {...field} placeholder="Wrong size" />
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
                    <Textarea {...field} />
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
