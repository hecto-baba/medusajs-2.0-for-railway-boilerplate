import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { Options } from "multer"
import multer from "multer"

/**
 * Multer's failures for multi-file uploads, translated into MedusaErrors.
 *
 * Same reasoning as csvUpload in the transaction-type import: this wraps
 * multer rather than sitting after it as an Express error handler, because
 * entries in `defineMiddlewares` are always invoked with three arguments, so
 * a four-argument error handler never receives `next`.
 *
 * Without the translation a rejected upload is a plain Error rather than a
 * MedusaError, and Medusa's handler answers with an opaque 500 "An unknown
 * error occurred." The guard fires either way, but the vendor is told nothing
 * about why their file was refused - a wrong file type reads as a server
 * fault rather than as something they can correct.
 */
export const arrayUpload = (options: Options, field: string) => {
  const handler = multer(options).array(field)

  return (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    handler(req as any, res as any, (error: unknown) => {
      if (!error) {
        next()
        return
      }

      const code = (error as { code?: string })?.code
      const name = (error as Error)?.name

      if (name === "MulterError" && code === "LIMIT_FILE_SIZE") {
        const limit = options.limits?.fileSize

        next(
          new MedusaError(
            MedusaError.Types.INVALID_DATA,
            limit
              ? `That file is too large. The limit is ${Math.round(
                  Number(limit) / (1024 * 1024)
                )}MB per image.`
              : "That file is too large."
          )
        )
        return
      }

      if (name === "MulterError" && code === "LIMIT_FILE_COUNT") {
        const limit = options.limits?.files

        next(
          new MedusaError(
            MedusaError.Types.INVALID_DATA,
            limit
              ? `Only ${limit} images can be uploaded at a time.`
              : "Too many files were uploaded at once."
          )
        )
        return
      }

      // The fileFilter rejects with a plain Error whose message is already
      // written for a vendor to read.
      if (error instanceof Error) {
        next(new MedusaError(MedusaError.Types.INVALID_DATA, error.message))
        return
      }

      next(error as any)
    })
  }
}
