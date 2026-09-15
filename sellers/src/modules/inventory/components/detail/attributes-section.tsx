"use client"

import { type VendorInventoryItem } from "@lib/data/vendor-client"
import { ActionMenu, SectionRow } from "@modules/common"
import { Container, Heading } from "@medusajs/ui"
import { PencilSquare } from "@medusajs/icons"
import { useMemo, useState } from "react"
import { EditAttributesDrawer } from "../forms/edit-attributes-drawer"

const getFormattedCountry = (code?: string | null) => {
  if (!code) return "-"
  try {
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
    return regionNames.of(code.toUpperCase()) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

export const AttributesSection = ({ item }: { item: VendorInventoryItem }) => {
  const [isEditOpen, setIsEditOpen] = useState(false)

  const actions = useMemo(
    () => [
      {
        actions: [
          {
            label: "Edit",
            icon: <PencilSquare />,
            onClick: () => setIsEditOpen(true),
          },
        ],
      },
    ],
    []
  )

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Attributes</Heading>
          <ActionMenu groups={actions} />
        </div>
        <SectionRow title="Height" value={item.height} />
        <SectionRow title="Width" value={item.width} />
        <SectionRow title="Length" value={item.length} />
        <SectionRow title="Weight" value={item.weight} />
        <SectionRow title="MID Code" value={item.mid_code} />
        <SectionRow title="Material" value={item.material} />
        <SectionRow title="HS Code" value={item.hs_code} />
        <SectionRow
          title="Country of origin"
          value={getFormattedCountry(item.origin_country)}
        />
      </Container>

      <EditAttributesDrawer
        item={item}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  )
}
