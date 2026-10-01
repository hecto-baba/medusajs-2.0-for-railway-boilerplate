import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getVisibleIds, ScopedEntity } from "./platform-scope"

/**
 * A product body may reference a type and tags by id. A seller may only point at
 * ones they can use: their own, or a shared platform one. Another seller's id
 * answers 404 before anything is created or changed.
 */

export const PRODUCT_TYPES: ScopedEntity = {
  linkField: "product_types",
  entity: "product_type",
}

export const PRODUCT_TAGS: ScopedEntity = {
  linkField: "product_tags",
  entity: "product_tag",
}

type ProductReferenceBody = {
  type_id?: string | null
  tags?: Array<{ id?: string } | string> | null
} | null | undefined

const tagIdOf = (tag: { id?: string } | string): string | undefined =>
  typeof tag === "string" ? tag : tag?.id

export const assertVendorCanUseProductReferences = async (
  req: AuthenticatedMedusaRequest,
  bodies: ProductReferenceBody[]
): Promise<void> => {
  const typeIds = new Set<string>()
  const tagIds = new Set<string>()

  for (const body of bodies) {
    if (body?.type_id) {
      typeIds.add(body.type_id)
    }
    for (const tag of body?.tags ?? []) {
      const id = tagIdOf(tag)
      if (id) {
        tagIds.add(id)
      }
    }
  }

  if (typeIds.size) {
    const { owned, platform } = await getVisibleIds(req, PRODUCT_TYPES)
    const visible = new Set([...owned, ...platform])
    for (const id of typeIds) {
      if (!visible.has(id)) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product type not found.")
      }
    }
  }

  if (tagIds.size) {
    const { owned, platform } = await getVisibleIds(req, PRODUCT_TAGS)
    const visible = new Set([...owned, ...platform])
    for (const id of tagIds) {
      if (!visible.has(id)) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product tag not found.")
      }
    }
  }
}
