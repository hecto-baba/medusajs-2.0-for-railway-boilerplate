import { defineLink } from "@medusajs/framework/utils"
import AppointmentBookingModule from "../modules/appointment-booking"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  {
    linkable: AppointmentBookingModule.linkable.appointment,
    field: "service_product_id",
  },
  ProductModule.linkable.product,
  {
    readOnly: true,
  }
)
