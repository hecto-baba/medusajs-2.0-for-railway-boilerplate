import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../modules/company"

export default async function seedB2B({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const companyModule = container.resolve(COMPANY_MODULE) as any
  const customerModule = container.resolve(Modules.CUSTOMER) as any
  const authModule = container.resolve(Modules.AUTH) as any
  const remoteLink = container.resolve(ContainerRegistrationKeys.LINK) as any

  logger.info("Seeding B2B Company, Customer Group, and Members...")

  // 1. Create or retrieve Customer Group for contract pricing
  let customerGroup: any
  try {
    const [existingGroups] = await customerModule.listAndCountCustomerGroups({
      name: "Apex Wholesale Group",
    })
    if (existingGroups && existingGroups.length > 0) {
      customerGroup = existingGroups[0]
    } else {
      customerGroup = await customerModule.createCustomerGroups({
        name: "Apex Wholesale Group",
      })
    }
  } catch (err) {
    logger.warn("Could not create/get customer group: " + err)
  }

  // 2. Create Company
  let company: any
  const [existingCompanies] = await companyModule.listAndCountCompanies({
    name: "Apex Global Logistics LLC",
  })
  if (existingCompanies && existingCompanies.length > 0) {
    company = existingCompanies[0]
    logger.info(`Company already exists: ${company.name} (${company.id})`)
  } else {
    company = await companyModule.createCompanies({
      name: "Apex Global Logistics LLC",
      email: "contact@apexlogistics.com",
      phone: "+1 555 123 4567",
      address: "123 Industrial Boulevard",
      city: "Seattle",
      state: "Washington",
      postal_code: "98101",
      country_code: "us",
      currency_code: "eur",
    })
    logger.info(`Created company: ${company.name} (${company.id})`)
  }

  // Link company to Customer Group
  if (customerGroup && remoteLink) {
    try {
      await remoteLink.create({
        [COMPANY_MODULE]: {
          company_id: company.id,
        },
        [Modules.CUSTOMER]: {
          customer_group_id: customerGroup.id,
        },
      })
    } catch {}
  }

  // Helper to create customer, auth password, employee and links
  const createMember = async ({
    firstName,
    lastName,
    email,
    password,
    isAdmin,
    spendingLimit,
  }: {
    firstName: string
    lastName: string
    email: string
    password: string
    isAdmin: boolean
    spendingLimit: number | null
  }) => {
    // 1. Create or get customer
    let customer: any
    const existingCustomers = await customerModule.listCustomers({ email })
    if (existingCustomers && existingCustomers.length > 0) {
      customer = existingCustomers[0]
    } else {
      customer = await customerModule.createCustomers({
        email,
        first_name: firstName,
        last_name: lastName,
        phone: "+1 555 987 6543",
      })
    }

    // 2. Create auth password for storefront login
    try {
      if (authModule) {
        const regRes = await authModule.register("emailpass", {
          body: {
            email,
            password,
          },
        })
        if (regRes?.authIdentity) {
          await authModule.updateAuthIdentities({
            id: regRes.authIdentity.id,
            app_metadata: {
              customer_id: customer.id,
            },
          })
        }
      }
    } catch (authErr) {
      // Ignore if auth already exists
    }

    // 3. Create employee in company
    const employee = await companyModule.createEmployees({
      company_id: company.id,
      spending_limit: isAdmin ? null : spendingLimit,
      is_admin: isAdmin,
    })

    // 4. Link employee to customer
    if (remoteLink) {
      try {
        await remoteLink.create({
          [COMPANY_MODULE]: {
            employee_id: employee.id,
          },
          [Modules.CUSTOMER]: {
            customer_id: customer.id,
          },
        })
      } catch {}
    }

    // 5. Add customer to company wholesale group
    if (customerGroup) {
      try {
        await customerModule.addCustomerToGroup({
          customer_id: customer.id,
          customer_group_id: customerGroup.id,
        })
      } catch {}
    }

    logger.info(
      `Created ${isAdmin ? "Manager" : "Employee"}: ${firstName} ${lastName} (${email}) - Password: ${password}`
    )
  }

  // Create Manager (Unlimited budget, can approve orders)
  await createMember({
    firstName: "Alice",
    lastName: "Vance",
    email: "manager@apex.com",
    password: "Password123!",
    isAdmin: true,
    spendingLimit: null,
  })

  // Create Employee (1,000 EUR spending limit)
  await createMember({
    firstName: "Bob",
    lastName: "Miller",
    email: "employee@apex.com",
    password: "Password123!",
    isAdmin: false,
    spendingLimit: 1000,
  })

  logger.info("Finished seeding B2B dummy company and credentials successfully!")
}
