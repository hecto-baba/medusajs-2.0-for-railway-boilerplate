import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { DELIVERY_MODULE } from "../../../../modules/delivery"
import DeliveryModuleService from "../../../../modules/delivery/service"
import { handleDeliveryWorkflowId } from "../../../../workflows/delivery/workflows/handle-delivery"

function setCorsHeaders(req: MedusaRequest, res: MedusaResponse) {
  const origin = (req.headers.origin as string) || "*"
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-publishable-api-key"
  )
}

export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
  return res.status(204).end()
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const origin = (req.headers.origin as string) || "*"
  const deliveryModuleService: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)
  const { id } = req.params
  const delivery = await deliveryModuleService.retrieveDelivery(id)

  const headers = {
    "Content-Type": "text/event-stream",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
  }
  res.writeHead(200, headers)
  res.write("data: " + JSON.stringify({ message: "Subscribed to workflow", transactionId: delivery.transaction_id || undefined }) + "\n\n")

  const workflowEngine = req.scope.resolve(Modules.WORKFLOW_ENGINE) as any
  const workflowSubHandler = (data: any) => {
    res.write("data: " + JSON.stringify(data) + "\n\n")
  }

  await workflowEngine.subscribe({
    workflowId: handleDeliveryWorkflowId,
    transactionId: delivery.transaction_id,
    subscriber: workflowSubHandler,
  })

  req.on("close", () => {
    workflowEngine.unsubscribe({
      workflowId: handleDeliveryWorkflowId,
      transactionId: delivery.transaction_id,
      subscriber: workflowSubHandler,
    })
  })
}
