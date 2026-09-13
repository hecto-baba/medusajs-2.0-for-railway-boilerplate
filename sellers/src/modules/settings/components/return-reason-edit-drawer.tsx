"use client"

import { listVendorReturnReasons } from "@lib/data/vendor-client"
import { RouteDrawer } from "@modules/common"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { ReturnReasonForm } from "./return-reason-form"

/**
 * There is no GET /vendors/return-reasons/:id call here on purpose - the
 * list is already cached under the same query key the table uses
 * (["vendor-return-reasons", ...]), and a settings vendor's list is small
 * enough that finding the row client-side avoids a second round trip. A
 * genuinely large list would want its own single-item fetch instead.
 */
export const ReturnReasonEditDrawer = ({ id }: { id: string }) => {
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-return-reasons", 20, 0],
    queryFn: () => listVendorReturnReasons({ limit: 20, offset: 0 }),
  })

  const reason = data?.return_reasons.find((r) => r.id === id)

  if (isLoading) {
    return null
  }

  if (!reason) {
    // The id does not resolve in the cached page - most likely it belongs to
    // another vendor, or the row was deleted. Either way there is nothing to
    // edit, so send the vendor back to the list rather than render a blank
    // drawer.
    router.replace("/settings/return-reasons")
    return null
  }

  return (
    <RouteDrawer returnTo="/settings/return-reasons">
      <ReturnReasonForm reason={reason} />
    </RouteDrawer>
  )
}
