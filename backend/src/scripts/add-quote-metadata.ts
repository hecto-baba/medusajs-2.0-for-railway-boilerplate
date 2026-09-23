import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function addQuoteMetadata({ container }: ExecArgs) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  if (pg) {
    if (typeof pg.raw === "function") {
      await pg.raw('ALTER TABLE "quote" ADD COLUMN IF NOT EXISTS "metadata" jsonb;')
      console.log("Successfully added metadata column to quote table via pg.raw!")
    } else if (typeof pg.query === "function") {
      await pg.query('ALTER TABLE "quote" ADD COLUMN IF NOT EXISTS "metadata" jsonb;')
      console.log("Successfully added metadata column to quote table via pg.query!")
    }
  }
}
