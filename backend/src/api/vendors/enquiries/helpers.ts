import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { assertOwnership } from "../products/helpers"
import { getOwnedIds } from "../shared/vendor-scope"

/**
 * Confirms an enquiry id belongs to one of the calling vendor's products.
 *
 * An enquiry carries no vendor field - like rentals, ownership is derived
 * transitively. Here it goes through the enquiry's product_id (the
 * vendor <-> product link already exists), so the product's owner is the
 * enquiry's owner. Reuses assertOwnership rather than duplicating the
 * product-ownership query.
 *
 * "Does not exist" and "exists but is not yours" answer with the SAME 404
 * message, so a vendor cannot probe for other vendors' enquiry ids.
 */
export const assertVendorOwnsEnquiry = async (
  req: AuthenticatedMedusaRequest,
  enquiryId: string
): Promise<void> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: enquiries } = await query.graph({
    entity: "enquiry",
    fields: ["id", "product_id"],
    filters: { id: enquiryId },
  })

  const productId = enquiries[0]?.product_id

  if (!productId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Enquiry not found.")
  }

  try {
    await assertOwnership(req, productId)
  } catch (error) {
    // assertOwnership says "Product not found." - rewrite only that, so the
    // two failure paths read the same. Anything else (a database error, say)
    // must surface as itself, not be disguised as a 404.
    if (error instanceof MedusaError && error.type === MedusaError.Types.NOT_FOUND) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Enquiry not found.")
    }
    throw error
  }
}

/**
 * Ids of every product the calling vendor owns.
 *
 * Callers must treat an empty array as "match nothing", never as "no
 * filter" - an empty product_id filter would otherwise return every
 * vendor's enquiries.
 */
export const getVendorProductIds = (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => getOwnedIds(req, "products")
