import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createDeliveryWorkflow } from "../../../workflows/delivery/workflows/create-delivery"
import { handleDeliveryWorkflow } from "../../../workflows/delivery/workflows/handle-delivery"

const schema = z.object({
  cart_id: z.string(),
  restaurant_id: z.string(),
})

function setCorsHeaders(req: MedusaRequest, res: MedusaResponse) {
  const origin = (req.headers.origin as string) || "*"
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
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
  const validatedBody = schema.parse(req.body)

  const { result: delivery } = await createDeliveryWorkflow(req.scope).run({
    input: {
      cart_id: validatedBody.cart_id,
      restaurant_id: validatedBody.restaurant_id,
    },
  })

  const { transaction } = await handleDeliveryWorkflow(req.scope).run({
    input: {
      delivery_id: delivery.id,
    },
  })

  return res
    .status(200)
    .json({ message: "Delivery created", delivery, transaction })
}
