"use client"

import { BuildingStorefront, Tag } from "@medusajs/icons"
import { Heading, Text } from "@medusajs/ui"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback } from "react"
import { InventoryTable } from "./inventory-table"
import { ReservationsTable } from "./reservations-table"

type ViewType = "items" | "reservations"

const InventoryViewContent = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentView: ViewType =
    (searchParams.get("view") as ViewType) === "reservations"
      ? "reservations"
      : "items"

  const setView = useCallback(
    (view: ViewType) => {
      const params = new URLSearchParams(searchParams.toString())
      if (view === "items") {
        params.delete("view")
      } else {
        params.set("view", view)
      }
      router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="flex flex-col gap-y-6">
      {/* View Switcher Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-y-4">
        <div>
          <Heading level="h1" className="text-xl font-semibold">
            Inventory Management
          </Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Manage multi-warehouse stock levels, reservations, and inventory items.
          </Text>
        </div>

        {/* Medusa-styled Segmented Switcher */}
        <div className="bg-ui-bg-subtle border-ui-border-base flex items-center rounded-lg border p-1 self-start">
          <button
            type="button"
            onClick={() => setView("items")}
            className={`txt-compact-small-plus flex items-center gap-x-2 rounded-md px-3 py-1.5 transition-all ${
              currentView === "items"
                ? "bg-ui-bg-base text-ui-fg-base shadow-elevation-card-rest font-medium"
                : "text-ui-fg-subtle hover:text-ui-fg-base"
            }`}
          >
            <BuildingStorefront className="h-4 w-4" />
            <span>Items</span>
          </button>
          <button
            type="button"
            onClick={() => setView("reservations")}
            className={`txt-compact-small-plus flex items-center gap-x-2 rounded-md px-3 py-1.5 transition-all ${
              currentView === "reservations"
                ? "bg-ui-bg-base text-ui-fg-base shadow-elevation-card-rest font-medium"
                : "text-ui-fg-subtle hover:text-ui-fg-base"
            }`}
          >
            <Tag className="h-4 w-4" />
            <span>Reservations</span>
          </button>
        </div>
      </div>

      {/* Render Active View Table */}
      <div className="bg-ui-bg-base shadow-elevation-card-rest overflow-hidden rounded-lg">
        {currentView === "items" ? <InventoryTable /> : <ReservationsTable />}
      </div>
    </div>
  )
}

export const InventoryView = () => {
  return (
    <Suspense fallback={<div className="p-6 text-ui-fg-muted">Loading inventory…</div>}>
      <InventoryViewContent />
    </Suspense>
  )
}
