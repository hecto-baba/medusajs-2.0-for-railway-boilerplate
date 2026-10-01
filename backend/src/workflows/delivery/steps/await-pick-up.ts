import { createStep } from "@medusajs/framework/workflows-sdk"

export const awaitPickUpStepId = "await-pick-up"
export const awaitPickUpStep = createStep(
  { name: awaitPickUpStepId, async: true, timeout: 60 * 15, maxRetries: 2 },
  async () => {}
)
