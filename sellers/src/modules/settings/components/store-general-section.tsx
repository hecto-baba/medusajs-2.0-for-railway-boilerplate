"use client"

import { ALL_CURRENCIES } from "@lib/data/currencies"
import type { Vendor } from "@lib/data/vendor"
import {
  getVendorTaxonomy,
  listVendorRegions,
} from "@lib/data/vendor-client"
import { PencilSquare } from "@medusajs/icons"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { ActionMenu, SectionRow } from "@modules/common"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

/**
 * The Store section, laid out like the dashboard's StoreGeneralSection.
 * Displays Name, Handle, Logo, Default Currency, Default Region,
 * Default Sales Channel, and Default Location for full parity with Admin.
 */
export const StoreGeneralSection = ({ vendor }: { vendor: Vendor }) => {
  const { data: taxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: () => getVendorTaxonomy(),
  })

  const { data: regionsData } = useQuery({
    queryKey: ["vendor-regions"],
    queryFn: () => listVendorRegions(),
  })

  const metadata = (vendor.metadata as Record<string, any>) || {}

  // 1. Default Currency
  const defaultCurrencyCode =
    (metadata.default_currency_code as string) ||
    taxonomy?.currencies?.find((c) => c.is_default)?.code ||
    taxonomy?.currencies?.[0]?.code ||
    "usd"
  const currencyInfo =
    ALL_CURRENCIES[defaultCurrencyCode.toUpperCase()] || {
      code: defaultCurrencyCode.toUpperCase(),
      name: defaultCurrencyCode.toUpperCase(),
      symbol: "$",
    }

  // 2. Default Region
  const regions = regionsData?.regions ?? []
  const defaultRegionId =
    (metadata.default_region_id as string) || regions[0]?.id
  const defaultRegion = regions.find((r) => r.id === defaultRegionId) || regions[0]

  // 3. Default Sales Channel
  const salesChannels = taxonomy?.sales_channels ?? []
  const defaultSalesChannelId =
    (metadata.default_sales_channel_id as string) || salesChannels[0]?.id
  const defaultSalesChannel =
    salesChannels.find((sc) => sc.id === defaultSalesChannelId) || salesChannels[0]

  // 4. Default Location
  const stockLocations = taxonomy?.stock_locations ?? []
  const defaultLocationId =
    (metadata.default_location_id as string) || stockLocations[0]?.id
  const defaultLocation =
    stockLocations.find((l) => l.id === defaultLocationId) || stockLocations[0]

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Store</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Manage your store&apos;s details
          </Text>
        </div>
        <ActionMenu
          groups={[
            {
              actions: [
                {
                  label: "Edit",
                  to: "/settings/edit",
                  icon: <PencilSquare />,
                },
              ],
            },
          ]}
        />
      </div>

      <SectionRow title="Name" value={vendor.name} />
      <SectionRow title="Handle" value={vendor.handle} />
      <SectionRow title="Logo" value={vendor.logo || "-"} />

      <SectionRow
        title="Default Currency"
        value={
          <div className="flex items-center gap-x-2">
            <Badge size="2xsmall">{currencyInfo.code}</Badge>
            <Text size="small" leading="compact">
              {currencyInfo.name}
            </Text>
          </div>
        }
      />

      <SectionRow
        title="Default Region"
        value={
          defaultRegion ? (
            <Badge size="2xsmall" asChild>
              <Link href={`/settings/regions`}>{defaultRegion.name}</Link>
            </Badge>
          ) : (
            "-"
          )
        }
      />

      <SectionRow
        title="Default Sales Channel"
        value={
          defaultSalesChannel ? (
            <Badge size="2xsmall" asChild>
              <Link href={`/settings/sales-channels/${defaultSalesChannel.id}`}>
                {defaultSalesChannel.name}
              </Link>
            </Badge>
          ) : (
            "-"
          )
        }
      />

      <SectionRow
        title="Default Location"
        value={
          defaultLocation ? (
            <Badge size="2xsmall" asChild>
              <Link href={`/settings/locations/${defaultLocation.id}`}>
                {defaultLocation.name}
              </Link>
            </Badge>
          ) : (
            "-"
          )
        }
      />
    </Container>
  )
}
