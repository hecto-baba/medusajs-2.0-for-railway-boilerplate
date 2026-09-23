"use client"

import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Text, clx } from "@medusajs/ui"
import React, { ReactNode } from "react"
import type { LayoutSection } from "./types"

type SectionDropzoneProps = {
  section: LayoutSection
  items: string[]
  children: ReactNode
}

export function SectionDropzone({
  section,
  items,
  children,
}: SectionDropzoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: section.id })

  let strategy = verticalListSortingStrategy
  if (section.ordering === "grid") {
    strategy = rectSortingStrategy
  } else if (
    section.ordering === "horizontal-list" ||
    section.ordering === "horizontal-stretched"
  ) {
    strategy = horizontalListSortingStrategy
  }

  return (
    <div
      ref={setNodeRef}
      className={clx(
        "flex flex-col gap-y-1 transition-colors",
        isOver && "ring-ui-border-interactive rounded-lg ring-1 ring-dashed"
      )}
    >
      <SortableContext items={items} strategy={strategy}>
        {children}
      </SortableContext>
    </div>
  )
}
