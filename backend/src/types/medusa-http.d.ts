import { RequestHandler } from "express"

declare module "@medusajs/framework/http" {
  export const allowFields: (...fields: (string | string[])[]) => RequestHandler
}
