import { model } from "@medusajs/framework/utils"
import { ApprovalStatus } from "./approval-status"

export const Approval = model.define("approval", {
  id: model
    .id({
      prefix: "appr",
    })
    .primaryKey(),
  cart_id: model.text(),
  created_by: model.text(),
  statuses: model.hasMany(() => ApprovalStatus, {
    mappedBy: "approval",
  }),
})
