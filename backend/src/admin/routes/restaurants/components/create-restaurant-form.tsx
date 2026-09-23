import { Button, Drawer, Input, Label, toast } from "@medusajs/ui"
import { useForm, FormProvider, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"
import {
  AdminCreateRestaurantType,
  adminCreateRestaurantValidator,
} from "../validators"

type CreateRestaurantFormProps = {
  onSuccess: () => void
  onCancel: () => void
}

export const CreateRestaurantForm = ({
  onSuccess,
  onCancel,
}: CreateRestaurantFormProps) => {
  const queryClient = useQueryClient()
  const form = useForm<AdminCreateRestaurantType>({
    resolver: zodResolver(adminCreateRestaurantValidator),
    defaultValues: {
      name: "",
      handle: "",
      description: "",
      image_url: "",
      address: "",
      phone: "",
      email: "",
    },
  })

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (payload: AdminCreateRestaurantType) =>
      sdk.client.fetch("/admin/restaurants", {
        method: "POST",
        body: payload,
      }),
  })

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await mutateAsync(data)
      toast.success("Success", { description: "Restaurant created successfully" })
      queryClient.invalidateQueries({ queryKey: ["restaurants"] })
      onSuccess()
    } catch (error: any) {
      toast.error("Error", { description: error.message || "Failed to create restaurant" })
    }
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-4 overflow-y-auto">
          <Controller
            control={form.control}
            name="name"
            render={({ field }) => (
              <div className="flex flex-col space-y-2">
                <Label size="small" weight="plus">Name</Label>
                <Input {...field} placeholder="Restaurant name" />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="handle"
            render={({ field }) => (
              <div className="flex flex-col space-y-2">
                <Label size="small" weight="plus">Handle</Label>
                <Input {...field} placeholder="restaurant-handle" />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="address"
            render={({ field }) => (
              <div className="flex flex-col space-y-2">
                <Label size="small" weight="plus">Address</Label>
                <Input {...field} placeholder="123 Street" />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <div className="flex flex-col space-y-2">
                <Label size="small" weight="plus">Phone</Label>
                <Input {...field} placeholder="+123456789" />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="email"
            render={({ field }) => (
              <div className="flex flex-col space-y-2">
                <Label size="small" weight="plus">Email</Label>
                <Input {...field} placeholder="restaurant@example.com" />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="image_url"
            render={({ field }) => (
              <div className="flex flex-col space-y-2">
                <Label size="small" weight="plus">Image / Banner URL</Label>
                <Input {...field} placeholder="https://images.unsplash.com/..." />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <div className="flex flex-col space-y-2">
                <Label size="small" weight="plus">Description</Label>
                <Input {...field} placeholder="Speciality cuisine, gourmet flavors..." />
              </div>
            )}
          />
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex items-center justify-end gap-x-2">
            <Button size="small" variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="small" type="submit" isLoading={isPending}>
              Save and close
            </Button>
          </div>
        </Drawer.Footer>
      </form>
    </FormProvider>
  )
}
