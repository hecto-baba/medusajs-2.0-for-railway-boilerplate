import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Uploads product media for the calling vendor.
 *
 * Mirrors /admin/uploads. Uploaded files are not vendor-scoped in storage -
 * the File module has no notion of an owner - so this route intentionally
 * does no ownership check beyond the vendor actor gate: it only mints a URL.
 * What makes a file *a vendor's* is attaching its URL to one of their
 * products, and that write goes through the ownership-checked product routes.
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

  res.status(200).json({ files: result })
}
