import { Button, Drawer, Input, Label, toast, Switch } from "@medusajs/ui"
import { useForm, FormProvider, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"
import { adminEditRestaurantValidator, AdminEditRestaurantType } from "../validators"
import { Restaurant } from "../page"

type EditRestaurantFormProps = {
  restaurant: Restaurant
  onSuccess: () => void
  onCancel: () => void
}

export const EditRestaurantForm = ({
  restaurant,
  onSuccess,
  onCancel,
}: EditRestaurantFormProps) => {
  const queryClient = useQueryClient()
  const form = useForm<AdminEditRestaurantType>({
    resolver: zodResolver(adminEditRestaurantValidator),
    defaultValues: {
      name: restaurant.name || "",
      handle: restaurant.handle || "",
      description: (restaurant as any).description || "",
      image_url: (restaurant as any).image_url || "",
      address: restaurant.address || "",
      phone: (restaurant as any).phone || "",
      email: (restaurant as any).email || "",
      is_open: restaurant.is_open ?? false,
    },
  })

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (payload: AdminEditRestaurantType) =>
      sdk.client.fetch(`/admin/restaurants/${restaurant.id}`, {
        method: "POST",
        body: payload,
      }),
  })

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await mutateAsync(data)
      toast.success("Success", { description: "Restaurant updated successfully" })
      queryClient.invalidateQueries({ queryKey: ["restaurants"] })
      onSuccess()
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to update restaurant",
      })
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
          <Controller
            control={form.control}
            name="is_open"
            render={({ field: { value, onChange } }) => (
              <div className="flex items-center justify-between pt-2">
                <Label size="small" weight="plus">Status (Open / Closed)</Label>
                <Switch checked={value} onCheckedChange={onChange} />
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
