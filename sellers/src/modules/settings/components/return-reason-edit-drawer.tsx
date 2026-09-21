"use client"

import { getVendorReturnReason } from "@lib/data/vendor-client"
import { RouteDrawer } from "@modules/common"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { ReturnReasonForm } from "./return-reason-form"

export const ReturnReasonEditDrawer = ({ id }: { id: string }) => {
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-return-reason", id],
    queryFn: () => getVendorReturnReason(id),
  })

  const reason = data?.return_reason

  if (isLoading) {
    return null
  }

  if (!reason) {
    router.replace("/settings/return-reasons")
    return null
  }

  return (
    <RouteDrawer returnTo="/settings/return-reasons">
      <ReturnReasonForm reason={reason} />
    </RouteDrawer>
  )
}
