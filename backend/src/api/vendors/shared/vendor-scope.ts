import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * Generic vendor-ownership helpers for entities linked directly off `vendor`
 * (return reasons, refund reasons, orders, stock locations, sales channels, ...).
 * The field must be an existing vendor link in src/links/. Regions and country
 * tax regions are platform-owned and have no vendor link.
 *
 * `assertOwnership` in products/helpers.ts is not reused here on purpose: it
 * walks a fixed `vendor.products.id` path. These entities each hang off
 * `vendor` through a different link field (`return_reasons`, `regions`, ...),
 * so the field name is a parameter rather than a second hard-coded helper per
 * entity.
 *
 * Every rule from products/helpers.ts still applies here:
 *   1. Scope on actor_id, never a request field.
 *   2. Short-circuit an empty id list - it means "no constraint" downstream.
 *   3. Answer 404, never 403 - "exists but not yours" must be indistinguishable
 *      from "does not exist".
 */

/**
 * Returns the vendor id behind the calling admin.
 *
 * The single source of truth for resolving the vendor from the session. Every
 * feature's helpers.ts re-exports this rather than keeping its own copy, so a
 * fix here reaches every route. The vendor id is always derived from
 * `actor_id`, never from the request.
 */
export const getVendorId = async (
  req: AuthenticatedMedusaRequest
): Promise<string> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorId = vendorAdmin?.vendor?.id

  if (!vendorId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  return vendorId
}

/**
 * Returns every id the calling vendor owns of the given linked entity.
 *
 * `linkField` is the field name on `vendor` that reaches the entity (e.g.
 * `"return_reasons"`, `"regions"`) - the same name used in the module's
 * defineLink and therefore in the query graph.
 *
 * Returns an empty array rather than throwing when the vendor owns none: an
 * empty catalogue is a valid state, not an error, and callers are required by
 * convention to treat `[]` as "match nothing" rather than "no filter".
 */
export const getOwnedIds = async (
  req: AuthenticatedMedusaRequest,
  linkField: string
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: [`vendor.${linkField}.id`],
    filters: { id: [req.auth_context.actor_id] },
  })

  const linked = (vendorAdmin?.vendor as Record<string, unknown> | undefined)?.[
    linkField
  ] as { id?: string }[] | undefined

  return (linked ?? []).map((row) => row?.id).filter((id): id is string => !!id)
}

/**
 * Confirms the calling vendor owns `entityId` on the given link field.
 *
 * Every route that reads or writes a single row by id must call this before
 * touching it - see PRODUCTS.md §6, rule 4: a forgotten call fails *open*,
 * not closed, because the actor-type gate in middlewares.ts only proves the
 * caller is *a* vendor, never that this row is theirs.
 */
export const assertVendorOwns = async (
  req: AuthenticatedMedusaRequest,
  linkField: string,
  entityId: string,
  notFoundMessage: string
): Promise<void> => {
  const ownedIds = await getOwnedIds(req, linkField)

  if (!ownedIds.includes(entityId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, notFoundMessage)
  }
}

/**
 * Confirms every id in `entityIds` belongs to the calling vendor on the given
 * link field. Empty input is accepted as a no-op rather than rejected, so
 * batch routes with an optional id array do not need to special-case "none
 * supplied".
 */
export const assertVendorOwnsAll = async (
  req: AuthenticatedMedusaRequest,
  linkField: string,
  entityIds: string[],
  notFoundMessage: string
): Promise<void> => {
  const ids = entityIds.filter(Boolean)

  if (!ids.length) {
    return
  }

  const ownedIds = await getOwnedIds(req, linkField)
  const ownedSet = new Set(ownedIds)

  if (!ids.every((id) => ownedSet.has(id))) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, notFoundMessage)
  }
}
