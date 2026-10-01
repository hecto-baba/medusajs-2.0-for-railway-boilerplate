import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const orderModuleService = req.scope.resolve(Modules.ORDER) as any

  try {
    const order = await orderModuleService.previewOrderChange(id)
    if (order && order.id) {
      return res.status(200).json({ order })
    }
    throw new Error("Invalid order preview")
  } catch (err: any) {
    try {
      const order = await orderModuleService.retrieveOrder(id, {
        relations: ["items", "shipping_address", "billing_address", "shipping_methods"],
      })
      return res.status(200).json({
        order: {
          ...order,
          id: order?.id || id,
          order_change: null,
        },
      })
    } catch {
      return res.status(200).json({
        order: {
          id,
          order_change: null,
        },
      })
    }
  }
}

