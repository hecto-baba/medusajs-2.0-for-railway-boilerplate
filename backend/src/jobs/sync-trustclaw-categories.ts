import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { fetchSegments, fetchCategories, TrustClawCategory } from "../lib/trustclaw"

/**
 * Scheduled job: sync TrustClaw taxonomy → Medusa product_category table.
 *
 * Strategy:
 *   1. For each active TrustClaw segment, fetch the full category tree
 *      (tree=true gives us the full hierarchy in one request).
 *   2. Walk the tree depth-first and upsert each node into Medusa's
 *      product_category table.
 *   3. Use `metadata.trustclaw_id` as the stable foreign key to avoid
 *      creating duplicates on repeated runs.
 *   4. The Medusa category `handle` is derived from the TrustClaw `path`
 *      (e.g. "/SEEDS/COTTON_SEEDS" → "seeds--cotton-seeds") to ensure
 *      unique, URL-friendly slugs.
 *
 * Why not use createProductCategoryWorkflow?
 *   The workflow is designed for single-category creation and adds
 *   workflow-engine overhead. For a bulk import we talk directly to the
 *   Product module service.
 *
 * Run schedule: every Sunday at 02:00 (low-traffic time).
 * First run: also triggered manually with:
 *   npx medusa exec src/scripts/sync-trustclaw-categories.ts
 */
export default async function syncTrustclawCategories(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(Modules.PRODUCT)

  logger.info("[TrustClaw Sync] Starting category synchronisation…")

  // -------------------------------------------------------------------------
  // 1. Load all existing Medusa categories that were previously synced from
  //    TrustClaw so we can skip or update them instead of creating duplicates.
  // -------------------------------------------------------------------------
  const existingRaw = await productModuleService.listProductCategories(
    {},
    { select: ["id", "handle", "metadata"] as any, take: 10_000 }
  )

  // Build a map of trustclaw_id → medusa_category_id for fast lookup
  const tcIdToMedusaId = new Map<string, string>()
  for (const cat of existingRaw) {
    const tcId = (cat.metadata as any)?.trustclaw_id as string | undefined
    if (tcId) tcIdToMedusaId.set(tcId, cat.id)
  }

  logger.info(
    `[TrustClaw Sync] Found ${tcIdToMedusaId.size} previously-synced categories`
  )

  // -------------------------------------------------------------------------
  // 2. Fetch all active segments from TrustClaw
  // -------------------------------------------------------------------------
  let segments
  try {
    segments = await fetchSegments()
  } catch (err: any) {
    logger.error(`[TrustClaw Sync] Failed to fetch segments: ${err.message}`)
    return
  }

  logger.info(`[TrustClaw Sync] ${segments.length} segments to process`)

  let created = 0
  let updated = 0
  let failed = 0

  // -------------------------------------------------------------------------
  // 3. For each segment fetch the full tree, then walk it depth-first
  // -------------------------------------------------------------------------
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

    /**
     * Recursively upsert a TrustClaw category node into Medusa.
     * Returns the Medusa category id so children can set their parent_category_id.
     */
    const upsertNode = async (
      node: TrustClawCategory,
      parentMedusaId: string | null
    ): Promise<void> => {
      // Build a deterministic handle from the TrustClaw path.
      // "/SEEDS/COTTON_SEEDS" → "seeds--cotton-seeds"
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
          // Update name/handle/description in case they changed upstream
          await productModuleService.updateProductCategories(existingMedusaId, {
            name: node.name,
            handle,
            description: node.description ?? undefined,
            is_active: true,
            metadata,
          } as any)
          updated++
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
      } catch (err: any) {
        // Duplicate handle is the most common error (same category in two
        // segments). Log and continue so the rest of the tree still syncs.
        logger.warn(
          `[TrustClaw Sync] Skipped "${node.code}" (${node.id}): ${err.message}`
        )
        failed++
        return
      }

      // Recurse into children
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
    `[TrustClaw Sync] Done. Created: ${created}, Updated: ${updated}, Failed/Skipped: ${failed}`
  )
}

export const config = {
  name: "sync-trustclaw-categories",
  // Every Sunday at 02:00. Adjust to your preference.
  schedule: "0 2 * * 0",
}
