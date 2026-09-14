"use client"

import {
  listVendorCustomerGroups,
  type VendorPriceList,
} from "@lib/data/vendor-client"
import { ActionMenu, SectionRow } from "@modules/common"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { Calendar, PencilSquare, Users } from "@medusajs/icons"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { PriceListEditDrawer } from "../forms/price-list-edit-drawer"

type ConfigurationSectionProps = {
  priceList: VendorPriceList
}

export const ConfigurationSection = ({
  priceList,
}: ConfigurationSectionProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false)

  const groupRuleIds = priceList.rules?.customer_group_id || []

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
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const startsFormatted = formatDateTime(priceList.starts_at)
  const endsFormatted = formatDateTime(priceList.ends_at)

  const getValidityStatus = () => {
    const now = new Date()
    if (priceList.starts_at && new Date(priceList.starts_at) > now) {
      return (
        <Badge size="small" color="orange">
          Scheduled
        </Badge>
      )
    }
    if (priceList.ends_at && new Date(priceList.ends_at) < now) {
      return (
        <Badge size="small" color="red">
          Expired
        </Badge>
      )
    }
    return (
      <Badge size="small" color="green">
        Active Now
      </Badge>
    )
  }

  return (
    <>
      <Container className="p-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-x-2">
            <Calendar className="h-5 w-5 text-ui-fg-subtle" />
            <Heading level="h2">Configuration & Rules</Heading>
          </div>

          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Edit Configuration",
                    icon: <PencilSquare className="h-4 w-4" />,
                    onClick: () => setIsEditOpen(true),
                  },
                ],
              },
            ]}
          />
        </div>

        <div className="flex flex-col divide-y pt-2">
          {/* Schedule Status */}
          <SectionRow
            title="Schedule Status"
            value={getValidityStatus()}
          />

          {/* Starts At */}
          <SectionRow
            title="Starts At"
            value={
              startsFormatted ? (
                <Text size="small" className="text-ui-fg-base font-medium">
                  {startsFormatted}
                </Text>
              ) : (
                <Text size="small" className="text-ui-fg-subtle">
                  Immediately on activation
                </Text>
              )
            }
          />

          {/* Ends At */}
          <SectionRow
            title="Ends At"
            value={
              endsFormatted ? (
                <Text size="small" className="text-ui-fg-base font-medium">
                  {endsFormatted}
                </Text>
              ) : (
                <Text size="small" className="text-ui-fg-subtle">
                  No expiration date
                </Text>
              )
            }
          />

          {/* Customer Group Rules */}
          <SectionRow
            title="Customer Groups"
            value={
              groupRuleIds.length === 0 ? (
                <Text size="small" className="text-ui-fg-subtle">
                  Applies to all customers (No group restrictions)
                </Text>
              ) : (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <Users className="h-4 w-4 text-ui-fg-subtle mr-1" />
                  {groupRuleIds.map((groupId) => {
                    const group = matchedGroups.find((g) => g.id === groupId)
                    return (
                      <Link
                        key={groupId}
                        href={`/customers/groups/${groupId}`}
                        className="hover:opacity-80 transition-opacity"
                      >
                        <Badge size="small" color="blue">
                          {group?.name || groupId}
                        </Badge>
                      </Link>
                    )
                  })}
                </div>
              )
            }
          />
        </div>
      </Container>

      <PriceListEditDrawer
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        priceList={priceList}
      />
    </>
  )
}
