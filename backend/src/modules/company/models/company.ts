import { model } from "@medusajs/framework/utils"
import { Employee } from "./employee"

export const Company = model.define("company", {
  id: model
    .id({
      prefix: "comp",
    })
    .primaryKey(),
  name: model.text(),
  email: model.text(),
  phone: model.text().nullable(),
  address: model.text().nullable(),
  city: model.text().nullable(),
  state: model.text().nullable(),
  postal_code: model.text().nullable(),
  country_code: model.text().nullable(),
  currency_code: model.text().default("eur"),
  employees: model.hasMany(() => Employee, {
    mappedBy: "company",
  }),
})
