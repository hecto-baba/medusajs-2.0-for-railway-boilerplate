import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getOwnedIds } from "./vendor-scope"

/**
 * Visibility rule for resources that sellers may own but that also exist as
 * shared PLATFORM resources (stock locations, sales channels, shipping profiles,
 * ...).
 *
 * A seller may SEE and USE:
 *   - owned:    linked to this seller (they may also edit and delete these)
 *   - platform: linked to NO seller. Shared and read-only for sellers.
 * A resource owned by ANOTHER seller is never visible or usable: it answers 404.
 */

export type ScopedEntity = {
  /** Field on `vendor` that reaches the entity, e.g. "stock_locations". */
  linkField: string
  /** Query-graph entity name, e.g. "stock_location". */
  entity: string
}

export type VisibleIds = {
  owned: string[]
  platform: string[]
}

export const getVisibleIds = async (
  req: AuthenticatedMedusaRequest,
  { linkField, entity }: ScopedEntity
): Promise<VisibleIds> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const owned = await getOwnedIds(req, linkField)

  // Everything any seller owns, to tell platform resources apart.
  const { data: vendors } = await query.graph({
    entity: "vendor",
    fields: ["id", `${linkField}.id`],
  })

  const claimed = new Set<string>(
    (vendors ?? []).flatMap((vendor: any) =>
      (vendor?.[linkField] ?? []).map((row: any) => row?.id).filter(Boolean)
    )
  )

  const { data: all } = await query.graph({ entity, fields: ["id"] })

  const platform = (all ?? [])
    .map((row: any) => row?.id as string)
    .filter((id) => !!id && !claimed.has(id))

  return { owned, platform }
}

/** Seller owns it, or it is a shared platform resource (read and use). */
export const assertVendorCanSee = async (
  req: AuthenticatedMedusaRequest,
  scoped: ScopedEntity,
  id: string,
  notFoundMessage: string
): Promise<void> => {
  const { owned, platform } = await getVisibleIds(req, scoped)

  if (!owned.includes(id) && !platform.includes(id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, notFoundMessage)
  }
}
