import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { importProductsAsChunksWorkflow } from "@medusajs/medusa/core-flows"
import { assertOwnership } from "../helpers"

/**
 * Starts a CSV product import for the calling vendor.
 *
 * SECURITY - read before changing this route.
 *
 * The import pipeline splits rows into a create bucket (keyed by handle) and an
 * update bucket (keyed by the "Product Id" column), and hands both to
 * batchProductsWorkflow. Nothing downstream knows about vendors: a row naming
 * another vendor's product id would update *that vendor's product*, and the
 * write happens inside an async background step with no request context, so it
 * cannot be guarded after the fact.
 *
 * The check therefore has to happen here, before the import is accepted: every
 * product id appearing in the uploaded CSV must already belong to the caller.
 * A file that names an id they do not own is rejected outright rather than
 * partially applied.
 *
 * Rows without an id are creates, and are allowed - but see the confirm route
 * for why those still need linking afterwards.
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

  // The uploaded file is read back and scanned before the workflow starts.
  // Parsing it here duplicates a little of what the pipeline does later, but
  // it is the only point at which the request - and therefore the vendor - is
  // still in scope.
  const contents = await file.getAsBuffer(body.file_key)
  const text = contents.toString("utf-8")

  const ids = extractProductIds(text)

  for (const productId of ids) {
    // Reuses the audited guard, which answers 404 for a product the vendor
    // does not own - the same answer a non-existent id gets, so the response
    // cannot be used to probe whether an id exists.
    await assertOwnership(req, productId)
  }

  const { result, transaction } = await importProductsAsChunksWorkflow(
    req.scope
  ).run({
    input: {
      filename: body.originalname,
      fileKey: body.file_key,
    },
  })

  res
    .status(202)
    .json({ transaction_id: transaction.transactionId, summary: result })
}

/**
 * Pulls the values of the "Product Id" column out of a raw CSV.
 *
 * Deliberately simple and conservative: it finds the id column by header name
 * and collects every non-empty value. A quoted field containing a comma would
 * confuse the split, so a row that does not parse cleanly is treated as
 * carrying an id (and therefore checked) rather than skipped - failing closed.
 */
const extractProductIds = (csv: string): string[] => {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim())

  if (!lines.length) {
    return []
  }

  const headers = lines[0].split(",").map((header) =>
    header.trim().replace(/^"|"$/g, "").toLowerCase()
  )

  const idIndex = headers.findIndex(
    (header) => header === "product id" || header === "product_id"
  )

  if (idIndex === -1) {
    return []
  }

  const ids = new Set<string>()

  for (const line of lines.slice(1)) {
    const cells = line.split(",")

    // A row with fewer cells than the header means the naive split was thrown
    // off by a quoted comma. Rather than guess, refuse the file: a silently
    // mis-parsed row is exactly how an unchecked id would slip through.
    if (cells.length < headers.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The CSV could not be read safely. Remove commas from quoted fields, or import without a Product Id column to create new products."
      )
    }

    const value = cells[idIndex]?.trim().replace(/^"|"$/g, "")

    if (value) {
      ids.add(value)
    }
  }

  return [...ids]
}
