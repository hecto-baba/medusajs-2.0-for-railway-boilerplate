"use client"

import { listVendorOrders, type VendorOrder } from "@lib/data/vendor-client"
import { ArrowDownTray } from "@medusajs/icons"
import { Button, toast } from "@medusajs/ui"
import { useState } from "react"

type OrderExportButtonProps = {
  currentOrders?: VendorOrder[]
  search?: string
  status?: string
  paymentStatus?: string
  fulfillmentStatus?: string
  regionId?: string
  salesChannelId?: string
  createdAtGte?: string
  updatedAtGte?: string
  order?: string
}

export const OrderExportButton = ({
  currentOrders,
  search,
  status,
  paymentStatus,
  fulfillmentStatus,
  regionId,
  salesChannelId,
  createdAtGte,
  updatedAtGte,
  order,
}: OrderExportButtonProps) => {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      // Fetch up to 100 matching orders for export
      const res = await listVendorOrders({
        limit: 100,
        offset: 0,
        q: search || undefined,
        order,
        status: status !== "all" ? status : undefined,
        payment_status: paymentStatus !== "all" ? paymentStatus : undefined,
        fulfillment_status: fulfillmentStatus !== "all" ? fulfillmentStatus : undefined,
        region_id: regionId,
        sales_channel_id: salesChannelId,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
      })

      const ordersToExport = res.orders?.length ? res.orders : currentOrders ?? []

      if (!ordersToExport.length) {
        toast.info("No orders to export.")
        return
      }

      const headers = [
        "Order #",
        "Date",
        "Customer Email",
        "Sales Channel",
        "Status",
        "Payment Status",
        "Fulfillment Status",
        "Total",
        "Currency",
      ]

      const rows = ordersToExport.map((o) => {
        const payStatus = o.payment_collections?.[0]?.status ?? "not_paid"
        const fulfillments = o.fulfillments ?? []
        const fulStatus = !fulfillments.length
          ? "not_fulfilled"
          : fulfillments.some((f) => f.delivered_at)
            ? "delivered"
            : fulfillments.some((f) => f.shipped_at)
              ? "shipped"
              : "fulfilled"

        return [
          `#${o.display_id}`,
          new Date(o.created_at).toISOString().split("T")[0],
          `"${(o.customer?.email || o.email || "").replace(/"/g, '""')}"`,
          `"${(o.sales_channel?.name || "").replace(/"/g, '""')}"`,
          o.status,
          payStatus,
          fulStatus,
          Number(o.total || 0).toFixed(2),
          (o.currency_code || "USD").toUpperCase(),
        ].join(",")
      })

      const csvContent = [headers.join(","), ...rows].join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `orders-export-${new Date().toISOString().split("T")[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${ordersToExport.length} orders successfully.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export orders."
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      size="small"
      variant="secondary"
      onClick={handleExport}
      isLoading={isExporting}
      className="shrink-0 gap-x-1.5"
    >
      <ArrowDownTray className="h-4 w-4" />
      <span>Export</span>
    </Button>
  )
}
