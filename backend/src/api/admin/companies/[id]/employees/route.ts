import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../../../../../modules/company"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: [company] } = await query.graph({
      entity: "company",
      fields: [
        "id",
        "employees.*",
        "employees.customer.*",
      ],
      filters: {
        id: req.params.id,
      },
    })

    return res.json({
      employees: company?.employees ?? [],
    })
  } catch (error) {
    const companyModule = req.scope.resolve(COMPANY_MODULE) as any
    const employees = await companyModule.listEmployees({
      company_id: req.params.id,
    })

    return res.json({ employees })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const companyModule = req.scope.resolve(COMPANY_MODULE) as any
  const customerModule = req.scope.resolve(Modules.CUSTOMER) as any
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const body = (req.body || {}) as any
  const {
    first_name,
    last_name,
    email,
    password,
    is_admin = false,
    spending_limit = null,
    phone,
  } = body

  if (!email) {
    return res.status(400).json({ message: "Email is required" })
  }

  // 1. Find or create Customer
  let customer: any
  const existingCustomers = await customerModule.listCustomers({ email })
  if (existingCustomers && existingCustomers.length > 0) {
    customer = existingCustomers[0]
  } else {
    customer = await customerModule.createCustomers({
      email,
      first_name: first_name || "Employee",
      last_name: last_name || "",
      phone,
    })
  }

  // 2. If password provided, register auth identity so storefront login works immediately
  if (password) {
    try {
      const authModule = req.scope.resolve(Modules.AUTH) as any
      if (authModule) {
        const registerRes = await authModule.register("emailpass", {
          body: {
            email,
            password,
          },
        })
        if (registerRes?.authIdentity) {
          await authModule.updateAuthIdentities({
            id: registerRes.authIdentity.id,
            app_metadata: {
              customer_id: customer.id,
            },
          })
        }
      }
    } catch (authErr) {
      console.warn("Could not register auth identity or it already exists:", authErr)
    }
  }

  // 3. Create Employee record in Company module
  const employee = await companyModule.createEmployees({
    company_id: req.params.id,
    spending_limit: is_admin ? null : spending_limit,
    is_admin: Boolean(is_admin),
  })

  // 4. Link Employee to Customer via remoteLink
  if (remoteLink) {
    await remoteLink.create({
      [COMPANY_MODULE]: {
        employee_id: employee.id,
      },
      [Modules.CUSTOMER]: {
        customer_id: customer.id,
      },
    })
  }

  // 5. If company has a customer group, add customer to group for B2B pricing
  try {
    const { data: [comp] } = await query.graph({
      entity: "company",
      fields: ["customer_group.id"],
      filters: { id: req.params.id },
    })

    if (comp?.customer_group?.id) {
      await customerModule.addCustomerToGroup({
        customer_id: customer.id,
        customer_group_id: comp.customer_group.id,
      })
    }
  } catch (groupErr) {
    console.warn("Could not attach customer to company customer group:", groupErr)
  }

  return res.status(201).json({
    employee: {
      ...employee,
      customer,
    },
  })
}
