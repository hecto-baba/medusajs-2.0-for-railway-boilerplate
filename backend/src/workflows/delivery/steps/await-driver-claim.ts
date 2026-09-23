import { createStep } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const awaitDriverClaimStepId = "await-driver-claim-step"
export const awaitDriverClaimStep = createStep(
  { name: awaitDriverClaimStepId, async: true, timeout: 60 * 15, maxRetries: 2 },
  async function (_, { container }) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    logger.info("Awaiting driver to claim...")
  }
)
