"use client"

import { getVendorRefundReason } from "@lib/data/vendor-client"
import { RouteDrawer } from "@modules/common"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { RefundReasonForm } from "./refund-reason-form"

export const RefundReasonEditDrawer = ({ id }: { id: string }) => {
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-refund-reason", id],
    queryFn: () => getVendorRefundReason(id),
  })

  const reason = data?.refund_reason

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
