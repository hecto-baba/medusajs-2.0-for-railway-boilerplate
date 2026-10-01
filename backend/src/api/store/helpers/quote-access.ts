import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Who may see or act on a quote from the storefront.
 *
 * A quote belongs to a customer. The signed-in customer, and the other
 * employees of the same company (a company shares its quotes), may use it.
 * A quote with NO owner yet (a guest request, before it is accepted) is reachable
 * by its id alone: the id is the guest's only handle, as in the guest link.
 * Everyone else gets "not found", never "forbidden", so ids cannot be probed.
 *
 * Before this, several routes either checked nothing, or checked only when the
 * caller happened to be signed in, so an anonymous caller skipped the check.
 */

/** The signed-in customer plus their company colleagues. Empty when nobody is signed in. */
export const getVisibleCustomerIds = async (req: MedusaRequest): Promise<string[]> => {
  const actorId = (req as any).auth_context?.actor_id as string | undefined
  if (!actorId) {
    return []
  }

  const ids = [actorId]
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      fields: ["id", "employee.company.id"],
      filters: { id: actorId },
    })
    const companyId = customer?.employee?.company?.id
    if (companyId) {
      const { data: employees } = await query.graph({
        entity: "employee",
        fields: ["customer_id"],
        filters: { company_id: companyId },
      })
      for (const employee of employees ?? []) {
        if (employee.customer_id && !ids.includes(employee.customer_id)) {
          ids.push(employee.customer_id)
        }
      }
    }
  } catch {
    // No company: just the customer.
  }

  return ids
}

export const canAccessQuote = async (
  req: MedusaRequest,
  quote: { customer_id?: string | null }
): Promise<boolean> => {
  if (!quote.customer_id) {
    return true
  }
  // A guest who accepted a quote is bound to a placeholder customer without an account;
  // the quote stays theirs by id.
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [owner],
  } = await query.graph({ entity: "customer", fields: ["id", "has_account"], filters: { id: quote.customer_id } })
  if (owner && owner.has_account === false) {
    return true
  }
  const visible = await getVisibleCustomerIds(req)
  return visible.includes(quote.customer_id)
}
