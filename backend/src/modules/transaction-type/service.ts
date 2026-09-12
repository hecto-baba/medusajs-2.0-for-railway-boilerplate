import { MedusaService } from "@medusajs/framework/utils"
import { TransactionType } from "./models/transaction-type"
import { TransactionTypeActivity } from "./models/transaction-type-activity"

/**
 * Generated CRUD only, for now. MedusaService builds create/list/listAndCount/
 * retrieve/update/delete plus softDelete and restore for both models, which
 * covers everything the workflows need - the lifecycle rules and the audit
 * writes live in workflow steps rather than here, so they apply no matter
 * which caller triggers them.
 */
class TransactionTypeModuleService extends MedusaService({
  TransactionType,
  TransactionTypeActivity,
}) {}

export default TransactionTypeModuleService
