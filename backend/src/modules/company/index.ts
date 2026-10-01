import CompanyModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const COMPANY_MODULE = "company"

export default Module(COMPANY_MODULE, {
  service: CompanyModuleService,
})
