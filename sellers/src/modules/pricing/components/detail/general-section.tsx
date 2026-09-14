"use client"

import { type VendorPriceList } from "@lib/data/vendor-client"
import { ActionMenu, SectionRow } from "@modules/common"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { PencilSquare, CurrencyDollar } from "@medusajs/icons"
import { useState } from "react"
import { PriceListEditDrawer } from "../forms/price-list-edit-drawer"

type GeneralSectionProps = {
  priceList: VendorPriceList
}

export const GeneralSection = ({ priceList }: GeneralSectionProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false)

  return (
    <>
      <Container className="p-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-x-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ui-bg-subtle text-ui-fg-subtle">
              <CurrencyDollar className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-x-2">
                <Heading level="h2">{priceList.title}</Heading>
                <Badge
                  size="small"
                  color={priceList.status === "active" ? "green" : "grey"}
                >
                  {priceList.status === "active" ? "Active" : "Draft"}
                </Badge>
                <Badge
                  size="small"
                  color={priceList.type === "sale" ? "blue" : "purple"}
                >
                  {priceList.type === "sale" ? "Sale" : "Override"}
                </Badge>
              </div>
              {priceList.description && (
                <Text size="small" className="text-ui-fg-subtle mt-0.5">
                  {priceList.description}
                </Text>
              )}
            </div>
          </div>

          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Edit Details",
                    icon: <PencilSquare className="h-4 w-4" />,
                    onClick: () => setIsEditOpen(true),
                  },
                ],
              },
            ]}
          />
        </div>

        <div className="flex flex-col divide-y pt-2">
          <SectionRow
            title="Price List Type"
            value={
              <Badge
                size="small"
                color={priceList.type === "sale" ? "blue" : "purple"}
              >
                {priceList.type === "sale" ? "Sale (Discounted prices)" : "Override (Base price override)"}
              </Badge>
            }
          />
          <SectionRow
            title="Status"
            value={
              <Badge
                size="small"
                color={priceList.status === "active" ? "green" : "grey"}
              >
                {priceList.status === "active" ? "Active" : "Draft"}
              </Badge>
            }
          />
          <SectionRow
            title="Description"
            value={priceList.description || "-"}
          />
          <SectionRow
            title="Created Date"
            value={
              priceList.created_at
                ? new Date(priceList.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-"
            }
          />
          {priceList.updated_at && (
            <SectionRow
              title="Last Updated"
              value={new Date(priceList.updated_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
          )}
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
