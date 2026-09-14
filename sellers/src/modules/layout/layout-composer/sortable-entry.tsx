"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { DotsSix, Eye, EyeSlash } from "@medusajs/icons"
import { IconButton, clx } from "@medusajs/ui"
import React, { ReactNode } from "react"
import type { LayoutControlSize } from "./types"

export function EntryContent({
  children,
  className,
  placeholderClassName,
}: {
  children: ReactNode
  className?: string
  placeholderClassName?: string
}) {
  return (
    <>
      <div className={clx("peer flex flex-col empty:hidden", className)}>
        {children}
      </div>
      <div
        aria-hidden
        className={clx(
          "text-ui-fg-muted hidden min-h-16 items-center justify-center px-2 text-center text-xs peer-[:empty]:flex",
          placeholderClassName
        )}
      >
        Empty section
      </div>
    </>
  )
}

type SortableEntryProps = {
  widgetId: string
  order: number
  hidden: boolean
  onToggleHidden: () => void
  children: ReactNode
  controlSize?: LayoutControlSize
}

export function SortableEntry({
  widgetId,
  order,
  hidden,
  onToggleHidden,
  children,
  controlSize = "default",
}: SortableEntryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widgetId })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const xsmall = controlSize === "xsmall"
  const small = controlSize === "small"
  const showLabel = controlSize === "default"

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clx(
        "ring-ui-border-base relative min-w-0 rounded-lg ring-1 transition-opacity",
        hidden && "opacity-30 grayscale",
        isDragging && "invisible"
      )}
    >
      <EntryContent
        className="h-full [&>*]:h-full"
        placeholderClassName="border-ui-border-strong h-full rounded-lg border border-dashed"
      >
        {children}
      </EntryContent>

      {/* Customize Overlay Controls */}
      <div
        className={clx(
          "bg-ui-bg-base shadow-elevation-card-rest border-ui-border-base absolute z-20 flex items-center rounded-md border",
          xsmall && "right-0 top-0 flex-col gap-y-0.5 p-0.5 opacity-80",
          small && "right-1.5 top-[min(50%,2.5px)] gap-x-0.5 p-0.5",
          showLabel && "right-2 top-2 gap-x-1 p-1"
        )}
      >
        {showLabel && (
          <span className="text-ui-fg-muted px-1 font-mono text-[10px]">
            {widgetId}
          </span>
        )}
        <IconButton
          size="2xsmall"
          variant="transparent"
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleHidden()
          }}
          aria-label={hidden ? "Show" : "Hide"}
          className={clx(xsmall && "h-3.5 w-3.5 p-0", small && "h-4 w-4 p-0.5")}
        >
          {hidden ? <EyeSlash className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </IconButton>
        <button
          type="button"
          className={clx(
            "text-ui-fg-muted hover:text-ui-fg-base cursor-grab touch-none rounded p-0.5 focus:outline-none",
            xsmall && "h-3.5 w-3.5",
            small && "h-4 w-4"
          )}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${widgetId}`}
        >
          <DotsSix className={clx(xsmall ? "h-3 w-3" : "h-3.5 w-3.5")} />
        </button>
      </div>
    </div>
  )
}
