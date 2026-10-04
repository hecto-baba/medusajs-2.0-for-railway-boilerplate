import { MedusaError } from "@medusajs/framework/utils"

/**
 * Recognising database constraint failures.
 *
 * Medusa's repository layer may convert a Postgres error into a MedusaError (a
 * unique violation becomes DUPLICATE_ERROR with an "already exists" message and
 * no `.code`), or pass the driver error through with its SQLSTATE `.code`. These
 * helpers accept either shape, and fall back to the message text, so the
 * friendly handling (idempotent returns, clean "just taken" messages, 409s) does
 * not silently depend on which shape arrives.
 */
const message = (err: any): string => String(err?.message ?? "")

/** A unique index/constraint rejected the write (SQLSTATE 23505). */
export const isUniqueViolation = (err: any): boolean =>
  err?.code === "23505" ||
  err?.type === MedusaError.Types.DUPLICATE_ERROR ||
  /duplicate key|unique constraint|already exists/i.test(message(err))

/** The overlap exclusion constraint rejected the write (SQLSTATE 23P01). */
export const isExclusionViolation = (err: any): boolean =>
  err?.code === "23P01" || /no_overlap|exclusion constraint/i.test(message(err))

/** The capacity trigger rejected the write (SQLSTATE 23514, "fully booked"). */
export const isCapacityViolation = (err: any): boolean =>
  err?.code === "23514" || /fully booked/i.test(message(err))
