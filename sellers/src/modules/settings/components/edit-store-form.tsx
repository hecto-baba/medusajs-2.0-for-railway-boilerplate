"use client"

import { updateVendorMe, type VendorMe } from "@lib/data/vendor-client"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Input, toast } from "@medusajs/ui"
import { Form, KeyboundForm, RouteDrawer, useRouteModal } from "@modules/common"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import * as zod from "zod"

const EditStoreSchema = zod.object({
  name: zod.string().min(1, "Store name is required."),
  logo: zod.string().optional(),
})

type Vendor = NonNullable<VendorMe["vendor"]>

export const EditStoreForm = ({ vendor }: { vendor: Vendor }) => {
  const { handleSuccess } = useRouteModal()

  const form = useForm<zod.infer<typeof EditStoreSchema>>({
    defaultValues: {
      name: vendor.name,
      logo: vendor.logo ?? "",
    },
    resolver: zodResolver(EditStoreSchema),
  })

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (values: zod.infer<typeof EditStoreSchema>) =>
      updateVendorMe({ name: values.name, logo: values.logo }),
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await mutateAsync(values)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save your store details."
      )
      return
    }

    toast.success("Store updated")
    handleSuccess()
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <RouteDrawer.Header>
          <RouteDrawer.Title>Edit store</RouteDrawer.Title>
          <RouteDrawer.Description>
            Manage your store&apos;s details
          </RouteDrawer.Description>
        </RouteDrawer.Header>

        <RouteDrawer.Body>
          <div className="flex flex-col gap-y-8">
            <Form.Field
              control={form.control}
              name="name"
              render={({ field }) => (
                <Form.Item>
                  <Form.Label>Name</Form.Label>
                  <Form.Control>
                    <Input {...field} />
                  </Form.Control>
                  <Form.ErrorMessage />
                </Form.Item>
              )}
            />

            <Form.Field
              control={form.control}
              name="logo"
              render={({ field }) => (
                <Form.Item>
                  <Form.Label optional>Logo</Form.Label>
                  <Form.Control>
                    <Input
                      {...field}
                      placeholder="https://example.com/logo.png"
                    />
                  </Form.Control>
                  <Form.ErrorMessage />
                </Form.Item>
              )}
            />

            <Form.Item>
              <Form.Label>Handle</Form.Label>
              <Input value={vendor.handle} disabled />
              <Form.Hint>
                Your store&apos;s unique identifier, used in storefront links.
              </Form.Hint>
            </Form.Item>
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
