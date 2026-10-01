import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { randomBytes } from "crypto"
import { COMPANY_MODULE } from "../../../../../../modules/company"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  if (!req.auth_context?.actor_id) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customerModule = req.scope.resolve(Modules.CUSTOMER) as any
  const companyModule = req.scope.resolve(COMPANY_MODULE) as any
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.LINK)

  // 1. Verify caller is a company manager
  const {
    data: [caller],
  } = await query.graph({
    entity: "customer",
    fields: [
      "id",
      "employee.*",
      "employee.company.*",
    ],
    filters: {
      id: req.auth_context.actor_id,
    },
  })

  const callerEmployee = (caller as any)?.employee
  const company = callerEmployee?.company

  if (!callerEmployee || !callerEmployee.is_admin || !company) {
    return res.status(403).json({
      message: "Only company managers can add new employees.",
    })
  }

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

  // The initial password is the manager's choice (8+ characters) or, when left out,
  // a random one returned ONCE in the response. It used to default to the same
  // well-known "Password123!" for every new employee.
  if (password !== undefined && (typeof password !== "string" || password.length < 8)) {
    return res.status(400).json({ message: "The password must be at least 8 characters." })
  }
  const initialPassword: string = password ?? randomBytes(12).toString("base64url")
  const generatedPassword = password === undefined

  // 2. Find or create customer
  let customer: any
  let createdNow = false
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
    createdNow = true
  }

  // 3. Register auth credentials, ONLY for a customer created just now. Someone who
  // already has an account keeps their own credentials: a manager must not be able
  // to set a password on another person's account by adding their email.
  try {
    const authModule = req.scope.resolve(Modules.AUTH) as any
    if (authModule && createdNow) {
      const registerRes = await authModule.register("emailpass", {
        body: {
          email,
          password: initialPassword,
        },
      })

      if (registerRes?.authIdentity) {
        await authModule.updateAuthIdentities([
          {
            id: registerRes.authIdentity.id,
            app_metadata: {
              customer_id: customer.id,
            },
          },
        ])
      }
    }
  } catch (err: any) {
    // Auth identity might already exist
  }

  // 4. Create employee record in company
  const employee = await companyModule.createEmployees({
    company_id: company.id,
    is_admin: Boolean(is_admin),
    spending_limit: spending_limit ? Number(spending_limit) : null,
  })

  // 5. Link employee to customer
  if (remoteLink) {
    try {
      await remoteLink.create({
        [COMPANY_MODULE]: { employee_id: employee.id },
        [Modules.CUSTOMER]: { customer_id: customer.id },
      })
    } catch {}
  }

  // 6. Return new employee with customer details
  return res.status(201).json({
    employee: {
      ...employee,
      customer,
    },
    // Shown once, only when the manager did not choose one and the account is new.
    ...(generatedPassword && createdNow ? { temporary_password: initialPassword } : {}),
  })
}
