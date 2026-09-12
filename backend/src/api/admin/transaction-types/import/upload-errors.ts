import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { Options } from "multer"
import multer from "multer"

/**
 * Multer's own failures, translated into MedusaErrors.
 *
 * This wraps multer rather than sitting after it as an Express error handler:
 * entries in a `defineMiddlewares` route are always invoked with three
 * arguments (see wrap-handler), so a four-argument error handler never
 * receives `next` and throws "next is not a function" on every request -
 * including the successful ones. Calling multer directly and inspecting what
 * it hands back is the only way to see its error from inside a normal
 * middleware.
 *
 * Without this, a rejected upload is a plain Error rather than a MedusaError,
 * so Medusa's handler falls through to its default branch and answers with an
 * opaque 500 "An unknown error occurred." The guard fires either way, but the
 * admin is told nothing about why their file was refused.
 */
export const csvUpload = (options: Options, field: string) => {
  const handler = multer(options).single(field)

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
              ? `The file is too large to import. The limit is ${Math.round(
                  Number(limit) / (1024 * 1024)
                )}MB.`
              : "The file is too large to import."
          )
        )
        return
      }

      if (name === "MulterError" && code === "LIMIT_FILE_COUNT") {
        next(
          new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Only one file can be imported at a time."
          )
        )
        return
      }

      // The fileFilter rejects with a plain Error whose message is already
      // written for an admin to read.
      if (error instanceof Error) {
        next(new MedusaError(MedusaError.Types.INVALID_DATA, error.message))
        return
      }

      next(error as any)
    })
  }
}
