import ExpressionOfInterestModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const EOI_MODULE = "expressionOfInterest"

export default Module(EOI_MODULE, {
  service: ExpressionOfInterestModuleService,
})
