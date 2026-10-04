import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useQuery, useMutation } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { useEffect, useState } from "react"
import { ServiceProvider } from "../types/appointment-booking"

type ProviderOption = {
  id: string
  display_name: string | null
  vendor_admin?: { email: string } | null
}

type ServiceProvidersResponse = { service_providers: ServiceProvider[] }
type ProvidersResponse = { providers: ProviderOption[] }

const ProductAppointmentConfigWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const prompt = usePrompt()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([])

  const { data, isLoading, refetch } = useQuery<ServiceProvidersResponse>({
    queryFn: () =>
      sdk.client.fetch(`/admin/products/${product.id}/appointment-config`),
    queryKey: [["products", product.id, "appointment-config"]],
  })

  // Explicit limit: the endpoint defaults to 15, which would silently hide every
  // provider after the first page from the picker.
  const { data: providersData } = useQuery<ProvidersResponse>({
    queryFn: () => sdk.client.fetch("/admin/providers", { query: { limit: 200 } }),
    queryKey: [["providers", "all"]],
  })

  const serviceProviders = data?.service_providers ?? []
  const providers = providersData?.providers ?? []

  const syncFromServer = () => {
    setDurationMinutes(serviceProviders[0]?.default_duration_minutes ?? 30)
    setSelectedProviderIds(serviceProviders.map((sp) => sp.provider_id))
  }

  useEffect(() => {
    syncFromServer()
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (body: { provider_ids: string[]; default_duration_minutes: number }) =>
      sdk.client.fetch(`/admin/products/${product.id}/appointment-config`, {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      toast.success("Appointment configuration updated")
      refetch()
      setDrawerOpen(false)
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update appointment configuration")
    },
  })

  const handleDrawerOpenChange = (open: boolean) => {
    // Closing (Cancel, overlay click, Escape) discards unsaved edits so the
    // next open starts from what is actually stored.
    if (!open) syncFromServer()
    setDrawerOpen(open)
  }

  const handleToggleProvider = (providerId: string, checked: boolean) => {
    setSelectedProviderIds((current) =>
      checked
        ? [...current, providerId]
        : current.filter((id) => id !== providerId)
    )
  }

  const handleSubmit = () => {
    saveMutation.mutate({
      provider_ids: selectedProviderIds,
      default_duration_minutes: durationMinutes,
    })
  }

  const handleMakeBookable = () => {
    setDrawerOpen(true)
  }

  const handleUnpublish = async () => {
    const confirmed = await prompt({
      title: "Make this product unbookable?",
      description:
        "It will no longer be offered by any provider. Existing bookings are not affected.",
      confirmText: "Make unbookable",
      cancelText: "Cancel",
    })
    if (!confirmed) return
    saveMutation.mutate({
      provider_ids: [],
      default_duration_minutes: durationMinutes,
    })
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Appointment Configuration</Heading>
          {!isLoading && serviceProviders.length > 0 && (
            <Badge color="green" size="2xsmall">
              Bookable
            </Badge>
          )}
        </div>

        {isLoading && (
          <div className="px-6 py-4">
            <Text className="text-ui-fg-subtle">Loading...</Text>
          </div>
        )}

        {!isLoading && !serviceProviders.length && (
          <>
            <div className="px-6 py-4">
              <Text className="text-ui-fg-subtle">
                This product is not currently bookable as an appointment.
              </Text>
            </div>
            <div className="flex justify-end border-t px-6 py-4">
              <Button size="small" onClick={handleMakeBookable} variant="secondary">
                Make Bookable
              </Button>
            </div>
          </>
        )}

        {!isLoading && serviceProviders.length > 0 && (
          <div className="divide-y">
            <div className="grid grid-cols-2 items-center px-6 py-4">
              <Text size="small" weight="plus" className="mb-1">
                Duration
              </Text>
              <Text className="text-ui-fg-subtle text-right">
                {serviceProviders[0].default_duration_minutes} minutes
              </Text>
            </div>
            <div className="grid grid-cols-2 items-start px-6 py-4">
              <Text size="small" weight="plus" className="mb-1">
                Providers
              </Text>
              <div className="flex flex-wrap justify-end gap-1">
                {serviceProviders.map((sp) => {
                  const provider = providers.find((p) => p.id === sp.provider_id)
                  return (
                    <Badge key={sp.id} size="2xsmall">
                      {provider?.display_name ||
                        provider?.vendor_admin?.email ||
                        sp.provider_id}
                    </Badge>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2 px-6 py-4 justify-end">
              <Button size="small" variant="secondary" onClick={handleMakeBookable}>
                Edit
              </Button>
              <Button
                size="small"
                variant="danger"
                onClick={handleUnpublish}
                disabled={saveMutation.isPending}
                isLoading={saveMutation.isPending}
              >
                Make Unbookable
              </Button>
            </div>
          </div>
        )}
      </Container>

      <Drawer open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {serviceProviders.length ? "Edit" : "Add"} Appointment Configuration
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="space-y-4">
            <div>
              <Label htmlFor="duration_minutes">Duration (minutes)</Label>
              <Input
                id="duration_minutes"
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              />
              <Text size="xsmall" className="text-ui-fg-subtle">
                How long one slot lasts - this is what slices a provider's working
                hours into individual bookable slots.
              </Text>
            </div>

            <hr />

            <div className="space-y-2">
              <Label>Providers offering this service</Label>
              {!providers.length && (
                <Text size="small" className="text-ui-fg-subtle">
                  No providers yet - staff create a provider profile from their own
                  admin session first.
                </Text>
              )}
              {providers.map((provider) => (
                <div key={provider.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`provider-${provider.id}`}
                    checked={selectedProviderIds.includes(provider.id)}
                    onCheckedChange={(checked) =>
                      handleToggleProvider(provider.id, checked === true)
                    }
                  />
                  <Label htmlFor={`provider-${provider.id}`} className="font-normal">
                    {provider.display_name || provider.vendor_admin?.email || provider.id}
                  </Label>
                </div>
              ))}
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleDrawerOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saveMutation.isPending || !selectedProviderIds.length}
                isLoading={saveMutation.isPending}
              >
                Save
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductAppointmentConfigWidget
