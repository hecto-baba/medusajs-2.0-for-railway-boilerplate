import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { fetchSegments, fetchCategories, TrustClawCategory } from "../lib/trustclaw"

/**
 * One-shot script to sync TrustClaw categories into Medusa product_category.
 *
 * Run with:
 *   npx medusa exec src/scripts/sync-trustclaw-categories.ts
 *
 * This is the same logic as the scheduled job
 * (src/jobs/sync-trustclaw-categories.ts) — use this for the initial
 * population or to force an out-of-cycle refresh.
 */
export default async function syncTrustclawCategoriesScript({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(Modules.PRODUCT)

  logger.info("[TrustClaw Sync] Starting category synchronisation…")

  const existingRaw = await productModuleService.listProductCategories(
    {},
    { select: ["id", "handle", "metadata"] as any, take: 10_000 }
  )

  const tcIdToMedusaId = new Map<string, string>()
  for (const cat of existingRaw) {
    const tcId = (cat.metadata as any)?.trustclaw_id as string | undefined
    if (tcId) tcIdToMedusaId.set(tcId, cat.id)
  }

  logger.info(
    `[TrustClaw Sync] Found ${tcIdToMedusaId.size} previously-synced categories`
  )

  let segments
  try {
    segments = await fetchSegments()
  } catch (err: any) {
    logger.error(`[TrustClaw Sync] Failed to fetch segments: ${err.message}`)
    return
  }

  logger.info(`[TrustClaw Sync] ${segments.length} segments to process`)

  let created = 0
  let updatedCount = 0
  let failed = 0

  for (const segment of segments) {
    logger.info(`[TrustClaw Sync] Processing segment: ${segment.name} (${segment.code})`)

    let tree: TrustClawCategory[]
    try {
      tree = await fetchCategories({
        segmentCode: segment.code,
        tree: "true",
        limit: "1000",
      })
    } catch (err: any) {
      logger.warn(
        `[TrustClaw Sync] Failed to fetch tree for ${segment.code}: ${err.message}`
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
          logger.info(`  ✓ Created: "${node.name}" (${node.code})`)
        }
      } catch (err: any) {
        logger.warn(
          `  ✗ Skipped "${node.code}" (${node.id}): ${err.message}`
        )
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

  logger.info(
    `[TrustClaw Sync] Done. Created: ${created}, Updated: ${updatedCount}, Failed/Skipped: ${failed}`
  )
}
