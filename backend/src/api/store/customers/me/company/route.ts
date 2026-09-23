import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  if (!req.auth_context?.actor_id) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: [customer] } = await query.graph({
      entity: "customer",
      fields: [
        "id",
        "email",
        "first_name",
        "last_name",
        "employee.*",
        "employee.company.*",
      ],
      filters: {
        id: req.auth_context.actor_id,
      },
    })

    const employee = (customer as any)?.employee || null
    const company = employee?.company || null

    let employees: any[] = []
    if (company?.id) {
      try {
        const { data: emps } = await query.graph({
          entity: "employee",
          fields: [
            "id",
            "is_admin",
            "spending_limit",
            "customer.*",
          ],
          filters: {
            company_id: company.id,
          },
        })
        employees = emps || []
      } catch (err) {
        // fallback if employee query fails
      }
    }

    return res.json({
      company,
      employee,
      employees,
      is_manager: Boolean(employee?.is_admin),
      spending_limit: employee?.spending_limit ? Number(employee.spending_limit) : null,
    })
  } catch (error) {
    return res.json({
      company: null,
      employee: null,
      employees: [],
      is_manager: false,
      spending_limit: null,
    })
  }
}
