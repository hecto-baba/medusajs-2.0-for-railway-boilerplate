import { createStep } from "@medusajs/framework/workflows-sdk"

export const awaitDeliveryStepId = "await-delivery"
export const awaitDeliveryStep = createStep(
  { name: awaitDeliveryStepId, async: true, timeout: 60 * 15, maxRetries: 2 },
  async () => {}
)
