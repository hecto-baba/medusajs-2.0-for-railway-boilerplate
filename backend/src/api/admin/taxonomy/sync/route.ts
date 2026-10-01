import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { fetchSegments, fetchCategories, TrustClawCategory } from "../../../../lib/trustclaw"

/**
 * POST /admin/taxonomy/sync
 *
 * Runs full category synchronization from TrustClaw into Medusa product_category table.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = req.scope.resolve(Modules.PRODUCT)

  try {
    logger.info("[TrustClaw Admin Sync] Triggered manual sync…")

    const existingRaw = await productModuleService.listProductCategories(
      {},
      { select: ["id", "handle", "metadata"] as any, take: 10_000 }
    )

    const tcIdToMedusaId = new Map<string, string>()
    for (const cat of existingRaw) {
      const tcId = (cat.metadata as any)?.trustclaw_id as string | undefined
      if (tcId) tcIdToMedusaId.set(tcId, cat.id)
    }

    const segments = await fetchSegments()
    let created = 0
    let updatedCount = 0
    let failed = 0

    for (const segment of segments) {
      let tree: TrustClawCategory[] = []
      try {
        tree = await fetchCategories({
          segmentCode: segment.code,
          tree: "true",
          limit: "1000",
        })
      } catch (err: any) {
        logger.warn(
          `[TrustClaw Admin Sync] Failed to fetch tree for ${segment.code}: ${err.message}`
        )
        failed++
        continue
      }

      const upsertNode = async (
        node: TrustClawCategory,
        parentMedusaId: string | null
      ): Promise<void> => {
        const handle = node.path
          .split("/")
          .filter(Boolean)
          .map((s) => s.toLowerCase().replace(/_/g, "-"))
          .join("--")

        const metadata = {
          trustclaw_id: node.id,
          trustclaw_code: node.code,
          trustclaw_path: node.path,
          trustclaw_segment_id: node.segmentId,
          trustclaw_segment_code: segment.code,
        }

        const existingMedusaId = tcIdToMedusaId.get(node.id)

        try {
          if (existingMedusaId) {
            await productModuleService.updateProductCategories(existingMedusaId, {
              name: node.name,
              handle,
              description: node.description ?? undefined,
              is_active: true,
              metadata,
            } as any)
            updatedCount++
          } else {
            const created_cat =
              await productModuleService.createProductCategories({
                name: node.name,
                handle,
                description: node.description ?? undefined,
                parent_category_id: parentMedusaId ?? undefined,
                is_active: true,
                rank: node.sortOrder,
                metadata,
              } as any)
            tcIdToMedusaId.set(node.id, (created_cat as any).id)
            created++
          }
        } catch {
          failed++
          return
        }

        if (node.children && node.children.length > 0) {
          const medusaId =
            tcIdToMedusaId.get(node.id) ?? existingMedusaId ?? null
          for (const child of node.children) {
            await upsertNode(child, medusaId)
          }
        }
      }

      for (const rootNode of tree) {
        await upsertNode(rootNode, null)
      }
    }

    return res.json({
      success: true,
      created,
      updated: updatedCount,
      failed,
      totalSynced: tcIdToMedusaId.size,
    })
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to synchronize taxonomy from TrustClaw.",
    })
  }
}
