import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { importProductsAsChunksWorkflow } from "@medusajs/medusa/core-flows"
import { readCsvReferences } from "./csv-references"
import {
  assertImportNotClaimedByAnotherSeller,
  assertImportReferencesUsable,
  recordImportStarted,
} from "./helpers"

/**
 * Starts a CSV product import for the calling vendor.
 *
 * SECURITY - read before changing this route.
 *
 * The import pipeline splits rows into a create bucket (keyed by handle) and an
 * update bucket (keyed by the "Product Id" column), and hands both to
 * batchProductsWorkflow. Nothing downstream knows about vendors: a row naming
 * another vendor's product id would update *that vendor's product*, and a row
 * naming another vendor's type, collection, tag, channel or shipping profile
 * would attach it. The writes happen inside an async background step with no
 * request context, so they cannot be guarded after the fact.
 *
 * The check therefore has to happen here, before the import is accepted: every
 * reference in the CSV must be one the caller may use. The file is read with the
 * same parser and header rules Medusa's importer uses (csv-references.ts), not by
 * splitting on commas, which a quoted comma defeats. A file that names anything
 * the caller may not use is rejected outright rather than partially applied.
 *
 * The import is then recorded against the caller: the confirm route refuses
 * anyone else, and the products it creates are linked back to the caller by
 * handle (see lib/link-imported-products.ts).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = req.validatedBody as {
    file_key: string
    originalname: string
  }

  const file = req.scope.resolve(Modules.FILE)

  // The uploaded file is read back and scanned before the workflow starts: this
  // is the only point at which the request - and therefore the vendor - is
  // still in scope.
  const contents = await file.getAsBuffer(body.file_key)
  const refs = readCsvReferences(contents.toString("utf-8"))

  await assertImportReferencesUsable(req, refs)
  await assertImportNotClaimedByAnotherSeller(req, body.file_key, refs.handles)

  const { result, transaction } = await importProductsAsChunksWorkflow(
    req.scope
  ).run({
    input: {
      filename: body.originalname,
      fileKey: body.file_key,
    },
  })

  await recordImportStarted(req, {
    transaction_id: transaction.transactionId,
    file_key: body.file_key,
    handles: refs.handles,
  })

  res
    .status(202)
    .json({ transaction_id: transaction.transactionId, summary: result })
}
