import { MedusaService } from "@medusajs/framework/utils"
import { Approval, ApprovalSettings, ApprovalStatus } from "./models"

class ApprovalModuleService extends MedusaService({
  Approval,
  ApprovalSettings,
  ApprovalStatus,
}) {}

export default ApprovalModuleService
