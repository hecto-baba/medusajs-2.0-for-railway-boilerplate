import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../../../../modules/marketplace"
import { getVendorOptionIds } from "../../product-options/helpers"
import { getVendorVariantIds } from "../../price-lists/helpers"
import { assertCategoriesAssignable } from "../../shared/category-scope"
import { getVisibleIds, ScopedEntity } from "../../shared/platform-scope"
import { getOwnedIds, getVendorId } from "../../shared/vendor-scope"
import type { CsvReferences } from "./csv-references"

/** An import that has not finished within this window no longer reserves its handles. */
export const IMPORT_ACTIVE_MS = 24 * 60 * 60 * 1000

const notFound = (what: string) => new MedusaError(MedusaError.Types.NOT_FOUND, `${what} not found.`)

const SCOPES = {
  types: { linkField: "product_types", entity: "product_type" },
  collections: { linkField: "product_collections", entity: "product_collection" },
  tags: { linkField: "product_tags", entity: "product_tag" },
  salesChannels: { linkField: "sales_channels", entity: "sales_channel" },
  shippingProfiles: { linkField: "shipping_profiles", entity: "shipping_profile" },
} satisfies Record<string, ScopedEntity>

const visibleSet = async (req: AuthenticatedMedusaRequest, scope: ScopedEntity) => {
  const { owned, platform } = await getVisibleIds(req, scope)
  return new Set([...owned, ...platform])
}

const allIn = (ids: string[], allowed: Set<string>) => ids.every((id) => allowed.has(id))

/**
 * Every reference in the CSV must be one the seller may use: products and
 * variants they own, and types, collections, categories, tags, channels and
 * shipping profiles that are theirs or shared. Anything else answers 404 before
 * the import starts, because once it starts nothing can be checked.
 */
export const assertImportReferencesUsable = async (
  req: AuthenticatedMedusaRequest,
  refs: CsvReferences
): Promise<void> => {
  if (refs.unsupportedColumns.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `These columns cannot be used in a seller import: ${refs.unsupportedColumns.join(", ")}.`
    )
  }

  if (refs.productIds.length) {
    const owned = new Set(await getOwnedIds(req, "products"))
    if (!allIn(refs.productIds, owned)) {
      throw notFound("Product")
    }
  }

  if (refs.variantIds.length) {
    const owned = new Set(await getVendorVariantIds(req))
    if (!allIn(refs.variantIds, owned)) {
      throw notFound("Product variant")
    }
  }

  if (refs.optionIds.length) {
    const owned = new Set(await getVendorOptionIds(req))
    if (!allIn(refs.optionIds, owned)) {
      throw notFound("Product option")
    }
  }

  if (refs.typeIds.length && !allIn(refs.typeIds, await visibleSet(req, SCOPES.types))) {
    throw notFound("Product type")
  }

  if (refs.collectionIds.length && !allIn(refs.collectionIds, await visibleSet(req, SCOPES.collections))) {
    throw notFound("Collection")
  }

  if (refs.salesChannelIds.length && !allIn(refs.salesChannelIds, await visibleSet(req, SCOPES.salesChannels))) {
    throw notFound("Sales channel")
  }

  if (refs.shippingProfileIds.length && !allIn(refs.shippingProfileIds, await visibleSet(req, SCOPES.shippingProfiles))) {
    throw notFound("Shipping profile")
  }

  await assertCategoriesAssignable(req, refs.categoryIds)

  // The importer matches tags by VALUE, across every tag in the store, so the
  // values named must belong to tags this seller can use.
  if (refs.tagValues.length) {
    const visibleTagIds = Array.from(await visibleSet(req, SCOPES.tags))

    if (!visibleTagIds.length) {
      throw notFound("Product tag")
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: tags } = await query.graph({
      entity: "product_tag",
      fields: ["id", "value"],
      filters: { id: visibleTagIds },
    })
    const values = new Set((tags ?? []).map((tag: any) => tag.value as string))

    if (!allIn(refs.tagValues, values)) {
      throw notFound("Product tag")
    }
  }
}

type ImportRecord = {
  id: string
  vendor_id: string
  transaction_id: string
  file_key: string
  handles: string[]
  status: string
  created_at: Date | string
}

const marketplace = (req: AuthenticatedMedusaRequest) => req.scope.resolve(MARKETPLACE_MODULE) as any

const isActive = (record: ImportRecord) =>
  Date.now() - new Date(record.created_at).getTime() < IMPORT_ACTIVE_MS

/**
 * The import file and the handles must not already belong to ANOTHER seller's
 * import. Handles are unique across products, and the products an import creates
 * are linked back to the seller by handle, so two sellers cannot share one.
 */
export const assertImportNotClaimedByAnotherSeller = async (
  req: AuthenticatedMedusaRequest,
  fileKey: string,
  handles: string[]
): Promise<void> => {
  const vendorId = await getVendorId(req)
  const records = (await marketplace(req).listVendorProductImports({})) as ImportRecord[]

  const others = records.filter((record) => record.vendor_id !== vendorId)

  if (others.some((record) => record.file_key === fileKey)) {
    throw notFound("File")
  }

  const taken = new Set(others.filter(isActive).flatMap((record) => record.handles ?? []))

  if (handles.some((handle) => taken.has(handle))) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "One or more product handles are already in use."
    )
  }
}

export const recordImportStarted = async (
  req: AuthenticatedMedusaRequest,
  input: { transaction_id: string; file_key: string; handles: string[] }
): Promise<void> => {
  const vendorId = await getVendorId(req)

  await marketplace(req).createVendorProductImports({
    vendor_id: vendorId,
    transaction_id: input.transaction_id,
    file_key: input.file_key,
    handles: input.handles,
    status: "pending",
  })
}

/** The import must exist and belong to the calling seller; otherwise 404. */
export const assertVendorOwnsImport = async (
  req: AuthenticatedMedusaRequest,
  transactionId: string
): Promise<ImportRecord> => {
  const vendorId = await getVendorId(req)
  const [record] = (await marketplace(req).listVendorProductImports({
    transaction_id: transactionId,
    vendor_id: vendorId,
  })) as ImportRecord[]

  if (!record) {
    throw notFound("Import")
  }

  return record
}

export const markImportConfirmed = async (
  req: AuthenticatedMedusaRequest,
  recordId: string
): Promise<void> => {
  await marketplace(req).updateVendorProductImports({ id: recordId, status: "confirmed" })
}
