import ProductEnquiryModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const PRODUCT_ENQUIRY_MODULE = "productEnquiry"

export default Module(PRODUCT_ENQUIRY_MODULE, {
  service: ProductEnquiryModuleService,
})
