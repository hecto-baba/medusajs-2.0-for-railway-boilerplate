"use client"

import { exportVendorInventoryItems } from "@lib/data/vendor-client"
import { Button, toast } from "@medusajs/ui"
import { useMutation } from "@tanstack/react-query"

export const InventoryExportButton = () => {
  const { mutateAsync: start, isPending } = useMutation({
    mutationFn: exportVendorInventoryItems,
  })

  const onExport = async () => {
    try {
      const result = await start()

      if (!result.csv || result.count === 0) {
        toast.info("There are no inventory items to export.")
        return
      }

      // Trigger instant browser download of the CSV
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute(
        "download",
        `inventory_export_${new Date().toISOString().split("T")[0]}.csv`
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${result.count} inventory items.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not export inventory."
      )
    }
  }

  return (
    <Button
      size="small"
      variant="secondary"
      onClick={onExport}
      isLoading={isPending}
    >
      Export
    </Button>
  )
}
