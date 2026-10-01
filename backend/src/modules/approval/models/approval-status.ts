import { model } from "@medusajs/framework/utils"
import { Approval } from "./approval"

export const ApprovalStatus = model.define("approval_status", {
  id: model
    .id({
      prefix: "appr_st",
    })
    .primaryKey(),
  status: model
    .enum(["pending", "approved", "rejected"])
    .default("pending"),
  type: model
    .enum(["admin", "sales_manager"])
    .default("admin"),
  created_by: model.text().nullable(),
  approval: model.belongsTo(() => Approval, {
    mappedBy: "statuses",
  }),
})
