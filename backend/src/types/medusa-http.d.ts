import "@medusajs/framework/http"
import type { RequestHandler } from "express"

declare module "@medusajs/framework/http" {
  export const allowFields: (...fields: (string | string[])[]) => RequestHandler
}
