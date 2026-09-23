import TransactionTypeModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const TRANSACTION_TYPE_MODULE = "transaction_type"

export default Module(TRANSACTION_TYPE_MODULE, {
  service: TransactionTypeModuleService,
})
