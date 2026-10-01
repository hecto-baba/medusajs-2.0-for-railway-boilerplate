import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { DeliveryStatus } from "../../../../modules/delivery/types"
import { updateDeliveryWorkflow } from "../../../../workflows/delivery/workflows/update-delivery"
import { awaitPickUpStepId } from "../../../../workflows/delivery/steps/await-pick-up"

function setCorsHeaders(req: MedusaRequest, res: MedusaResponse) {
  const origin = (req.headers.origin as string) || "*"
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-publishable-api-key"
  )
}

export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
  return res.status(204).end()
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
  const { id } = req.params

  const data = {
    id,
    delivery_status: DeliveryStatus.IN_TRANSIT,
  }

  const updatedDelivery = await updateDeliveryWorkflow(req.scope)
    .run({
      input: {
        data,
        stepIdToSucceed: awaitPickUpStepId,
      },
    })
    .catch((error) => {
      return MedusaError.Types.UNEXPECTED_STATE
    })

  return res.status(200).json({ delivery: updatedDelivery })
}
