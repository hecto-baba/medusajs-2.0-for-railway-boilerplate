"use client"

import { listVendorRefundReasons } from "@lib/data/vendor-client"
import { RouteDrawer } from "@modules/common"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { RefundReasonForm } from "./refund-reason-form"

/** Mirrors return-reason-edit-drawer.tsx - see its comment for the caveat. */
export const RefundReasonEditDrawer = ({ id }: { id: string }) => {
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-refund-reasons", 20, 0],
    queryFn: () => listVendorRefundReasons({ limit: 20, offset: 0 }),
  })

  const reason = data?.refund_reasons.find((r) => r.id === id)

  if (isLoading) {
    return null
  }

  if (!reason) {
    router.replace("/settings/refund-reasons")
    return null
  }

  return (
    <RouteDrawer returnTo="/settings/refund-reasons">
      <RefundReasonForm reason={reason} />
    </RouteDrawer>
  )
}
