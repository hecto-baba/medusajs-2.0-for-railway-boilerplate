"use client"

import type { Vendor } from "@lib/data/vendor"
import { PencilSquare } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { ActionMenu, SectionRow } from "@modules/common"

/**
 * The Store section, laid out like the dashboard's StoreGeneralSection.
 */
export const StoreGeneralSection = ({ vendor }: { vendor: Vendor }) => {
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
    </Container>
  )
}
