import { OrderDTO, InferTypeOf } from "@medusajs/framework/types"
import DigitalProductOrderModel from "../models/digital-product-order"

export enum MediaType {
  MAIN = "main",
  PREVIEW = "preview",
}

export enum OrderStatus {
  PENDING = "pending",
  SENT = "sent",
}

export type DigitalProductOrder = InferTypeOf<typeof DigitalProductOrderModel> & {
  order?: OrderDTO
}
