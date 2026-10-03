import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import { getVendorId } from "../shared/vendor-scope"

/**
 * Uploads product media for the calling vendor.
 *
 * Mirrors /admin/uploads. The File module has no notion of an owner, so storage
 * itself is unscoped; each upload is therefore RECORDED against the calling seller
 * (vendor_upload), which makes every file attributable to its uploader: listed
 * back to them, countable, auditable. Whether a file ends up on a product is still
 * decided by the ownership-checked product routes; the file URL stays public, like
 * product images.
 *
 * Size and type limits are enforced by the multer middleware registered for
 * this matcher, not here, so an oversized upload is rejected before its bytes
 * are buffered into memory.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  // Typed locally rather than via Express.Multer: @types/multer is not a
  // dependency here, so that namespace does not exist at compile time.
  type UploadedFile = {
    originalname: string
    mimetype: string
    buffer: Buffer
  }

  const files = (req as unknown as { files?: UploadedFile[] }).files

  if (!files?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No files were uploaded"
    )
  }

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: files.map((file) => ({
        filename: file.originalname,
        mimeType: file.mimetype,
        content: file.buffer.toString("base64"),
        access: "public",
      })),
    },
  })

  // Attribute each stored file to the seller who uploaded it (same order as the input).
  const vendorId = await getVendorId(req)
  const marketplace: any = req.scope.resolve(MARKETPLACE_MODULE)
  await marketplace.createVendorUploads(
    (result as any[]).map((stored, index) => ({
      vendor_id: vendorId,
      file_id: stored.id,
      url: stored.url,
      filename: files[index]?.originalname ?? null,
      mime_type: files[index]?.mimetype ?? null,
      size: files[index]?.buffer?.length ?? null,
    }))
  )

  res.status(200).json({ files: result })
}

/** The calling seller's own uploads, newest first. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const vendorId = await getVendorId(req)
  const marketplace: any = req.scope.resolve(MARKETPLACE_MODULE)
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100)
  const offset = Math.max(Number(req.query.offset) || 0, 0)

  const [uploads, count] = await marketplace.listAndCountVendorUploads(
    { vendor_id: vendorId },
    { skip: offset, take: limit, order: { created_at: "DESC" } }
  )

  res.json({ uploads, count, limit, offset })
}
