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
 * Robustly resolves the vendor admin record for the authenticated session.
 * 
 * In Medusa 2.0, req.auth_context.actor_id may be:
 * 1. The vendor_admin.id (standard)
 * 2. The vendor.id (when token was minted directly with vendor_id)
 * 3. Or auth_identity may be linked to vendor_admin by email
 * 
 * Checking all three ensures the seller session resolves reliably.
 */
export const resolveVendorAdmin = async (
  req: AuthenticatedMedusaRequest,
  fields: string[] = ["id", "vendor.id"]
): Promise<any> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // 1. Match vendor_admin by id (standard when actor_id is vendor_admin.id)
  if (req.auth_context?.actor_id) {
    const {
      data: [byAdminId],
    } = await query.graph({
      entity: "vendor_admin",
      fields,
      filters: { id: [req.auth_context.actor_id] },
    }).catch(() => ({ data: [] }))

    if (byAdminId) {
      return byAdminId
    }

    // 2. Match vendor_admin by vendor_id (when actor_id is vendor.id)
    const {
      data: [byVendorId],
    } = await query.graph({
      entity: "vendor_admin",
      fields,
      filters: { vendor_id: [req.auth_context.actor_id] },
    }).catch(() => ({ data: [] }))

    if (byVendorId) {
      return byVendorId
    }
  }

  // 3. Fallback: resolve from auth_identity app_metadata or email
  if (req.auth_context?.auth_identity_id) {
    const {
      data: [authIdentity],
    } = await query.graph({
      entity: "auth_identity",
      fields: ["app_metadata", "provider_identities.*"],
      filters: { id: [req.auth_context.auth_identity_id] },
    }).catch((err: any) => {
      console.warn("[resolveVendorAdmin] query auth_identity failed:", err?.message || err)
      return { data: [] }
    })

    const vendorAdminId = (authIdentity?.app_metadata as Record<string, any> | undefined)?.vendor_id
    if (vendorAdminId) {
      const {
        data: [byAppMetadataAdmin],
      } = await query.graph({
        entity: "vendor_admin",
        fields,
        filters: { id: [vendorAdminId] },
      }).catch(() => ({ data: [] }))

      if (byAppMetadataAdmin) {
        return byAppMetadataAdmin
      }

      const {
        data: [byAppMetadataVendor],
      } = await query.graph({
        entity: "vendor_admin",
        fields,
        filters: { vendor_id: [vendorAdminId] },
      }).catch(() => ({ data: [] }))

      if (byAppMetadataVendor) {
        return byAppMetadataVendor
      }
    }

    const email = authIdentity?.provider_identities?.[0]?.entity_id
    if (email) {
      const {
        data: [byEmail],
      } = await query.graph({
        entity: "vendor_admin",
        fields,
        filters: { email: [email] },
      }).catch((err: any) => {
        console.warn("[resolveVendorAdmin] query by email failed:", err?.message || err)
        return { data: [] }
      })

      if (byEmail) {
        return byEmail
      }
    }
  }

  // 4. Direct vendor match fallback (when actor_id or app_metadata vendor_id directly identifies the vendor)
  const candidateVendorIds = [
    req.auth_context?.actor_id,
    (req.auth_context as any)?.app_metadata?.vendor_id,
  ].filter((id): id is string => typeof id === "string" && id.length > 0)

  for (const vId of candidateVendorIds) {
    const {
      data: [directVendor],
    } = await query.graph({
      entity: "vendor",
      fields: [
        "id",
        "name",
        "handle",
        "logo",
        "metadata",
        "admins.id",
        "admins.email",
        "admins.first_name",
        "admins.last_name",
      ],
      filters: { id: [vId] },
    }).catch(() => ({ data: [] }))

    if (directVendor) {
      const admin = directVendor.admins?.[0]
      return {
        id: admin?.id || vId,
        email: admin?.email || "vendor@store.com",
        first_name: admin?.first_name || null,
        last_name: admin?.last_name || null,
        vendor_id: directVendor.id,
        vendor: {
          id: directVendor.id,
          name: directVendor.name,
          handle: directVendor.handle,
          logo: directVendor.logo,
          metadata: directVendor.metadata,
        },
      }
    }
  }

  return null
}

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
  const vendorAdmin = await resolveVendorAdmin(req, ["id", "vendor.id"])
  const vendorId = vendorAdmin?.vendor?.id

  if (vendorId) {
    return vendorId
  }

  // Fallback: check if actor_id itself is a vendor id directly
  if (req.auth_context?.actor_id) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [vendor],
    } = await query.graph({
      entity: "vendor",
      fields: ["id"],
      filters: { id: [req.auth_context.actor_id] },
    }).catch(() => ({ data: [] }))

    if (vendor?.id) {
      return vendor.id
    }
  }

  throw new MedusaError(
    MedusaError.Types.NOT_FOUND,
    "No vendor found for the authenticated session."
  )
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
  const vendorAdmin = await resolveVendorAdmin(req, [`vendor.${linkField}.id`])
  const linked = (vendorAdmin?.vendor as Record<string, unknown> | undefined)?.[
    linkField
  ] as { id?: string }[] | undefined

  if (linked) {
    return linked.map((row) => row?.id).filter((id): id is string => !!id)
  }

  // Fallback: if actor_id is vendor id
  if (req.auth_context?.actor_id) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [vendor],
    } = await query.graph({
      entity: "vendor",
      fields: [`${linkField}.id`],
      filters: { id: [req.auth_context.actor_id] },
    }).catch(() => ({ data: [] }))

    const vendorLinked = (vendor as Record<string, unknown> | undefined)?.[
      linkField
    ] as { id?: string }[] | undefined

    if (vendorLinked) {
      return vendorLinked.map((row) => row?.id).filter((id): id is string => !!id)
    }
  }

  return []
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
