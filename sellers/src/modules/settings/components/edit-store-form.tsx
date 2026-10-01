"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ALL_CURRENCIES } from "@lib/data/currencies"
import {
  getVendorTaxonomy,
  listVendorCurrencies,
  listVendorRegions,
  updateVendorMe,
  type VendorMe,
} from "@lib/data/vendor-client"
import { Button, Input, Select, toast } from "@medusajs/ui"
import { Form, KeyboundForm, RouteDrawer, useRouteModal } from "@modules/common"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import * as zod from "zod"

const EditStoreSchema = zod.object({
  name: zod.string().min(1, "Store name is required."),
  logo: zod.string().optional(),
  default_currency_code: zod.string().optional(),
  default_region_id: zod.string().optional(),
  default_sales_channel_id: zod.string().optional(),
  default_location_id: zod.string().optional(),
})

type Vendor = NonNullable<VendorMe["vendor"]>

export const EditStoreForm = ({ vendor }: { vendor: Vendor }) => {
  const { handleSuccess } = useRouteModal()
  const queryClient = useQueryClient()

  const metadata = (vendor.metadata as Record<string, any>) || {}

  const { data: taxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: () => getVendorTaxonomy(),
  })

  const { data: currenciesData } = useQuery({
    queryKey: ["vendor-currencies"],
    queryFn: () => listVendorCurrencies(),
  })

  const { data: regionsData } = useQuery({
    queryKey: ["vendor-regions"],
    queryFn: () => listVendorRegions(),
  })

  const supportedCurrencies =
    currenciesData?.currencies?.length
      ? currenciesData.currencies
      : taxonomy?.currencies?.map((c) => ({
          code: c.code,
          name: ALL_CURRENCIES[c.code.toUpperCase()]?.name || c.code.toUpperCase(),
          symbol: ALL_CURRENCIES[c.code.toUpperCase()]?.symbol || "$",
          is_default: c.is_default,
          is_tax_inclusive: false,
        })) || []

  const regions = regionsData?.regions ?? []
  const salesChannels = taxonomy?.sales_channels ?? []
  const stockLocations = taxonomy?.stock_locations ?? []

  const form = useForm<zod.infer<typeof EditStoreSchema>>({
    defaultValues: {
      name: vendor.name,
      logo: vendor.logo ?? "",
      default_currency_code:
        (metadata.default_currency_code as string) ||
        supportedCurrencies.find((c) => c.is_default)?.code ||
        supportedCurrencies[0]?.code ||
        "",
      default_region_id: (metadata.default_region_id as string) || regions[0]?.id || "",
      default_sales_channel_id:
        (metadata.default_sales_channel_id as string) || salesChannels[0]?.id || "",
      default_location_id:
        (metadata.default_location_id as string) || stockLocations[0]?.id || "",
    },
    resolver: zodResolver(EditStoreSchema),
  })

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (values: zod.infer<typeof EditStoreSchema>) => {
      const updatedMetadata = {
        ...metadata,
        default_currency_code: values.default_currency_code,
        default_region_id: values.default_region_id,
        default_sales_channel_id: values.default_sales_channel_id,
        default_location_id: values.default_location_id,
      }

      await updateVendorMe({
        name: values.name,
        logo: values.logo,
        metadata: updatedMetadata,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-me"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-taxonomy"] })
    },
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
            Manage your store&apos;s details, default currency, region, sales channel and location
          </RouteDrawer.Description>
        </RouteDrawer.Header>

        <RouteDrawer.Body>
          <div className="flex flex-col gap-y-6">
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

            {/* Default Currency */}
            <Form.Field
              control={form.control}
              name="default_currency_code"
              render={({ field }) => (
                <Form.Item>
                  <Form.Label optional>Default Currency</Form.Label>
                  <Form.Control>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <Select.Trigger>
                        <Select.Value placeholder="Select default currency" />
                      </Select.Trigger>
                      <Select.Content>
                        {supportedCurrencies.map((c) => (
                          <Select.Item key={c.code} value={c.code.toLowerCase()}>
                            {c.name} ({c.code.toUpperCase()})
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </Form.Control>
                  <Form.ErrorMessage />
                </Form.Item>
              )}
            />

            {/* Default Region */}
            {regions.length > 0 && (
              <Form.Field
                control={form.control}
                name="default_region_id"
                render={({ field }) => (
                  <Form.Item>
                    <Form.Label optional>Default Region</Form.Label>
                    <Form.Control>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <Select.Trigger>
                          <Select.Value placeholder="Select default region" />
                        </Select.Trigger>
                        <Select.Content>
                          {regions.map((r) => (
                            <Select.Item key={r.id} value={r.id}>
                              {r.name}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </Form.Control>
                    <Form.ErrorMessage />
                  </Form.Item>
                )}
              />
            )}

            {/* Default Sales Channel */}
            {salesChannels.length > 0 && (
              <Form.Field
                control={form.control}
                name="default_sales_channel_id"
                render={({ field }) => (
                  <Form.Item>
                    <Form.Label optional>Default Sales Channel</Form.Label>
                    <Form.Control>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <Select.Trigger>
                          <Select.Value placeholder="Select default sales channel" />
                        </Select.Trigger>
                        <Select.Content>
                          {salesChannels.map((sc) => (
                            <Select.Item key={sc.id} value={sc.id}>
                              {sc.name}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </Form.Control>
                    <Form.ErrorMessage />
                  </Form.Item>
                )}
              />
            )}

            {/* Default Location */}
            {stockLocations.length > 0 && (
              <Form.Field
                control={form.control}
                name="default_location_id"
                render={({ field }) => (
                  <Form.Item>
                    <Form.Label optional>Default Location</Form.Label>
                    <Form.Control>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <Select.Trigger>
                          <Select.Value placeholder="Select default location" />
                        </Select.Trigger>
                        <Select.Content>
                          {stockLocations.map((l) => (
                            <Select.Item key={l.id} value={l.id}>
                              {l.name}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </Form.Control>
                    <Form.ErrorMessage />
                  </Form.Item>
                )}
              />
            )}
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
