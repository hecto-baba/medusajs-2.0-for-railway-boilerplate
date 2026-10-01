import ApprovalModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const APPROVAL_MODULE = "approval"

export default Module(APPROVAL_MODULE, {
  service: ApprovalModuleService,
})
