"use client"

import {
  listVendorCustomerGroups,
  type VendorPriceList,
} from "@lib/data/vendor-client"
import { ActionMenu } from "@modules/common"
import { PencilSquare } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { PriceListConfigurationDrawer } from "../forms/price-list-configuration-drawer"

type ConfigurationSectionProps = {
  priceList: VendorPriceList
}

export const ConfigurationSection = ({
  priceList,
}: ConfigurationSectionProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false)

  const groupRuleIds =
    priceList.rules?.["customer.groups.id"] ||
    priceList.rules?.["customer_group_id"] ||
    []

  // Fetch customer groups to resolve IDs to names
  const { data: groupsData } = useQuery({
    queryKey: ["vendor-customer-groups", { limit: 100, offset: 0 }],
    queryFn: () => listVendorCustomerGroups({ limit: 100, offset: 0 }),
    enabled: groupRuleIds.length > 0,
  })

  const customerGroups = groupsData?.customer_groups ?? []
  const matchedGroups = customerGroups.filter((g) =>
    groupRuleIds.includes(g.id)
  )

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const startsFormatted = formatDateTime(priceList.starts_at)
  const endsFormatted = formatDateTime(priceList.ends_at)

  const groupsSummary =
    matchedGroups.length > 0
      ? matchedGroups.map((g) => g.name).join(", ")
      : groupRuleIds.length > 0
      ? `${groupRuleIds.length} groups`
      : null

  return (
    <>
      <Container className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2">Configuration</Heading>
            {groupsSummary && (
              <div className="txt-small-plus text-ui-fg-muted flex items-center gap-x-1.5 mt-0.5">
                <span className="text-ui-fg-subtle">Customer groups</span>
                <span>·</span>
                <span className="txt-small-plus text-ui-fg-muted font-medium">
                  {groupsSummary}
                </span>
              </div>
            )}
          </div>

          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Edit",
                    icon: <PencilSquare />,
                    onClick: () => setIsEditOpen(true),
                  },
                ],
              },
            ]}
          />
        </div>

        <div className="flex flex-col divide-y border-t border-ui-border-base pt-2">
          <div className="text-ui-fg-subtle grid grid-cols-2 items-center py-2 text-xs">
            <Text leading="compact" size="small" weight="plus">
              Starts at
            </Text>
            <Text size="small" className="text-pretty">
              {startsFormatted || "-"}
            </Text>
          </div>

          <div className="text-ui-fg-subtle grid grid-cols-2 items-center py-2 text-xs">
            <Text leading="compact" size="small" weight="plus">
              Ends at
            </Text>
            <Text size="small" className="text-pretty">
              {endsFormatted || "-"}
            </Text>
          </div>
        </div>
      </Container>

      <PriceListConfigurationDrawer
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        priceList={priceList}
      />
    </>
  )
}
