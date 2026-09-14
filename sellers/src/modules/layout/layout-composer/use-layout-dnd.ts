"use client"

import {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useCallback, useState } from "react"
import type { DisplayEntry, LayoutPreference } from "./types"

type UseLayoutDndProps = {
  entriesBySection: Record<string, DisplayEntry[]>
  widgetSectionMap: Record<string, string>
  validSectionIds: Set<string>
  setDraft: React.Dispatch<React.SetStateAction<LayoutPreference | null>>
}

export function useLayoutDnd({
  entriesBySection,
  widgetSectionMap,
  validSectionIds,
  setDraft,
}: UseLayoutDndProps) {
  const [activeEntry, setActiveEntry] = useState<DisplayEntry | null>(null)

  // Use a 5px movement constraint so regular clicks on links and buttons are not blocked
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = String(event.active.id)
      const section = widgetSectionMap[activeId]
      if (section && entriesBySection[section]) {
        const found = entriesBySection[section].find(
          (e) => e.widgetId === activeId
        )
        if (found) {
          setActiveEntry(found)
        }
      }
    },
    [widgetSectionMap, entriesBySection]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return

      const activeId = String(active.id)
      const overId = String(over.id)

      if (activeId === overId) return

      const activeSection = widgetSectionMap[activeId]
      const overSection = validSectionIds.has(overId)
        ? overId
        : widgetSectionMap[overId]

      if (!activeSection || !overSection) return

      if (activeSection !== overSection) {
        setDraft((prev) => {
          const current = prev?.widgets ?? {}
          return {
            widgets: {
              ...current,
              [activeId]: {
                ...current[activeId],
                section: overSection,
              },
            },
          }
        })
      }
    },
    [widgetSectionMap, validSectionIds, setDraft]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveEntry(null)

      if (!over) return

      const activeId = String(active.id)
      const overId = String(over.id)

      if (activeId === overId) return

      const activeSection = widgetSectionMap[activeId]
      const overSection = validSectionIds.has(overId)
        ? overId
        : widgetSectionMap[overId]

      if (!activeSection || !overSection) return

      const sectionEntries = entriesBySection[activeSection] || []
      const oldIndex = sectionEntries.findIndex((e) => e.widgetId === activeId)
      const newIndex = sectionEntries.findIndex((e) => e.widgetId === overId)

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(sectionEntries, oldIndex, newIndex)
        setDraft((prev) => {
          const current = prev?.widgets ?? {}
          const updatedWidgets = { ...current }
          reordered.forEach((entry, idx) => {
            updatedWidgets[entry.widgetId] = {
              ...updatedWidgets[entry.widgetId],
              order: idx,
              section: activeSection,
            }
          })
          return { widgets: updatedWidgets }
        })
      }
    },
    [widgetSectionMap, validSectionIds, entriesBySection, setDraft]
  )

  return {
    sensors,
    collisionDetection: closestCenter,
    activeEntry,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  }
}
