"use client"

import { exportVendorProducts } from "@lib/data/vendor-client"
import { Button, toast } from "@medusajs/ui"
import { useMutation } from "@tanstack/react-query"

/**
 * Starts a CSV export of the vendor's catalogue.
 *
 * There is no file to download here: the backend generates the CSV in a
 * background workflow and delivers it by email when it is ready, exactly as
 * the admin's export does. The button therefore reports that the export has
 * started rather than pretending to hand back a file.
 */
export const ProductExportButton = () => {
  const { mutateAsync: start, isPending } = useMutation({
    mutationFn: exportVendorProducts,
  })

  const onExport = async () => {
    try {
      const result = await start()

      // A null transaction id means the vendor has no products, so no
      // workflow was started and no email will arrive - saying "export
      // started" would leave them waiting for nothing.
      if (!result.transaction_id) {
        toast.info("There are no products to export yet.")
        return
      }

      toast.success("Export started. You will receive an email when it is ready.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start the export."
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
