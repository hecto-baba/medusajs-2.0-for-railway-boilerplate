import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { onboardingStore } from "../../../../lib/onboarding-store"
import {
  resolveTaxonomyDetails,
  type TrustClawAdminApplicationItem,
} from "../../../../lib/trustclaw"

/**
 * GET /admin/vendors/applications
 *
 * Lists all vendor onboarding applications with status filters and search.
 * Uses Medusa database vendors joined with onboardingStore states.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { status, segmentId, vendorTypeId, search, limit = "20", offset = "0" } =
    req.query as Record<string, string>

  const take = Math.max(1, parseInt(limit, 10) || 20)
  const skip = Math.max(0, parseInt(offset, 10) || 0)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // 1. Fetch vendors registered in Medusa
  const { data: vendors } = await query.graph({
    entity: "vendor",
    fields: ["id", "name", "handle", "logo", "created_at", "admins.*"],
    pagination: { order: { created_at: "DESC" } },
  })

  // 2. Map vendors with their actual onboarding application records
  let allItems: TrustClawAdminApplicationItem[] = await Promise.all(
    vendors.map(async (v: any) => {
      const record = onboardingStore.get(v.id)
      const resolved = await resolveTaxonomyDetails({
        segmentId: record.segmentId,
        vendorTypeId: record.vendorTypeId,
        vendorCategoryId: record.vendorCategoryId,
      })

      return {
        id: v.id,
        vendorId: v.id,
        vendorName: v.name || record.vendorName,
        email: v.admins?.[0]?.email || record.email,
        status: record.status || "DRAFT",
        currentStep: record.currentStep || "SEGMENT_SELECTION",
        completedSteps: record.completedSteps || [],
        segment: record.segment || resolved.segment || null,
        vendorType: record.vendorType || resolved.vendorType || null,
        vendorCategory: record.vendorCategory || resolved.vendorCategory || null,
        rejectionReason: record.rejectionReason,
        feedback: record.feedback,
        submittedAt: record.submittedAt,
        createdAt: v.created_at || record.createdAt,
        updatedAt: record.updatedAt || v.created_at,
      }
    })
  )

  // 3. Apply status filter
  if (status && status !== "ALL") {
    allItems = allItems.filter((item) => item.status === status)
  }

  // 4. Apply segment filter
  if (segmentId && segmentId !== "__ALL__") {
    allItems = allItems.filter((item) => {
      const rec = onboardingStore.get(item.vendorId)
      return rec.segmentId === segmentId || item.segment?.id === segmentId
    })
  }

  // 5. Apply search filter
  if (search && search.trim()) {
    const s = search.trim().toLowerCase()
    allItems = allItems.filter(
      (item) =>
        (item.vendorName && item.vendorName.toLowerCase().includes(s)) ||
        (item.email && item.email.toLowerCase().includes(s)) ||
        (item.vendorId && item.vendorId.toLowerCase().includes(s))
    )
  }

  const totalCount = allItems.length
  const paginatedItems = allItems.slice(skip, skip + take)

  return res.json({
    items: paginatedItems,
    count: totalCount,
    limit: take,
    offset: skip,
  })
}
