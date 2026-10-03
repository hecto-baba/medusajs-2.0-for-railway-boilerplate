import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { runPhase2Backfill } from "../lib/phase2-backfill"

/**
 * Phase 2, step 5: gives existing sellers their own shipping profile, moves
 * their products onto it, and sets up fulfilment on locations that predate
 * Phase 2. See lib/phase2-backfill.ts for exactly what it does and what it only
 * reports.
 *
 * DRY RUN by default (prints the plan, writes nothing):
 *   npx medusa exec ./src/scripts/phase2-backfill.ts
 * Apply:
 *   npx medusa exec ./src/scripts/phase2-backfill.ts apply
 *
 * Take a database backup before applying. Safe to run again.
 */
export default async function phase2Backfill({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const apply = (args ?? []).includes("apply")

  logger.info(apply ? "Phase 2 backfill: APPLYING changes" : "Phase 2 backfill: dry run (add `apply` to write)")

  const report = await runPhase2Backfill(container, { apply })

  logger.info(
    JSON.stringify(
      {
        applied: report.applied,
        sellers: report.sellers,
        profilesToCreate: report.profilesToCreate.length,
        productsToMove: report.productsToMove.length,
        locationsToProvision: report.locationsToProvision.length,
        needsAttention: {
          ...report.needsAttention,
          sellersWithProductsButNoLocation: report.needsAttention.sellersWithProductsButNoLocation.length,
          productsOnAnotherSellersProfile: report.needsAttention.productsOnAnotherSellersProfile.length,
        },
      },
      null,
      2
    )
  )
}
