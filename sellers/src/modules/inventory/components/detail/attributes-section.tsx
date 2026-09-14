"use client"

import { type VendorInventoryItem } from "@lib/data/vendor-client"
import { SectionRow } from "@modules/common"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { useState } from "react"
import { EditAttributesDrawer } from "../forms/edit-attributes-drawer"

export const AttributesSection = ({ item }: { item: VendorInventoryItem }) => {
  const [isEditOpen, setIsEditOpen] = useState(false)

  const dimensions = [
    item.length ? `${item.length}L` : null,
    item.width ? `${item.width}W` : null,
    item.height ? `${item.height}H` : null,
  ]
    .filter(Boolean)
    .join(" × ")

  return (
    <>
      <Container className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Heading level="h2">Attributes</Heading>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setIsEditOpen(true)}
          >
            Edit
          </Button>
        </div>

        <div className="flex flex-col">
          <SectionRow
            title="Requires shipping"
            value={item.requires_shipping ? "Yes" : "No"}
          />
          <SectionRow
            title="Dimensions"
            value={dimensions ? `${dimensions} cm` : "-"}
          />
          <SectionRow
            title="Weight"
            value={item.weight ? `${item.weight} g` : "-"}
          />
          <SectionRow
            title="Country of origin"
            value={item.origin_country || "-"}
          />
          <SectionRow
            title="Material"
            value={item.material || "-"}
          />
          <SectionRow
            title="HS Code"
            value={item.hs_code || "-"}
          />
          <SectionRow
            title="MID Code"
            value={item.mid_code || "-"}
          />
        </div>
      </Container>

      <EditAttributesDrawer
        item={item}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  )
}
