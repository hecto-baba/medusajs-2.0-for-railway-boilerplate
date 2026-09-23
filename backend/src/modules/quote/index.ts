import QuoteModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const QUOTE_MODULE = "quote"

export default Module(QUOTE_MODULE, {
  service: QuoteModuleService,
})
