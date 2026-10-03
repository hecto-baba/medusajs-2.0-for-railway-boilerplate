import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * Categories are the platform's shared taxonomy: every seller may list them and
 * place their products in them. INTERNAL categories are the platform's private
 * ones (hidden from the storefront), so to a seller they do not exist: they are
 * never listed and answer 404 when named.
 */
export const assertCategoriesAssignable = async (
  req: AuthenticatedMedusaRequest,
  categoryIds: string[]
): Promise<void> => {
  const ids = Array.from(new Set(categoryIds.filter(Boolean)))

  if (!ids.length) {
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "is_internal"],
    filters: { id: ids },
  })

  const assignable = new Set(
    (categories ?? []).filter((category: any) => !category.is_internal).map((category: any) => category.id)
  )

  if (ids.some((id) => !assignable.has(id))) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Category not found.")
  }
}
