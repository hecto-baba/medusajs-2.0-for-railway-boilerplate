/**
 * Which workflow executions belong to a seller.
 *
 * The workflow_execution table has no owner column; an execution is "run for" a
 * seller when its stored input carries the seller's id as the VALUE of
 * `vendor_admin_id` or `vendor_id` (the keys every seller workflow in this repo
 * uses). Matching the id ANYWHERE in the JSON, as this route used to, exposed any
 * execution that merely mentioned the id: another seller's note, a customer
 * field, a log line.
 *
 * The same pattern is used in SQL (Postgres regex, on the jsonb text) and in
 * JavaScript, so the list and the detail route cannot disagree.
 */

// Ids are generated (letters, digits, "_" and "-"); refuse anything else so a
// value can never alter the pattern.
const SAFE_ID = /^[A-Za-z0-9_-]+$/

const KEYS = "vendor_admin_id|vendor_id"

/** Returns null when an id is not safe to put in a pattern (then nothing matches). */
export const executionOwnerPatterns = (
  vendorAdminId: string,
  vendorId: string
): { sql: string; js: RegExp } | null => {
  if (!SAFE_ID.test(vendorAdminId) || !SAFE_ID.test(vendorId)) {
    return null
  }

  const ids = `${vendorAdminId}|${vendorId}`

  return {
    // Postgres regex over the text of a jsonb value: `"key": "id"` with optional spaces.
    sql: `"(${KEYS})"[[:space:]]*:[[:space:]]*"(${ids})"`,
    js: new RegExp(`"(${KEYS})"\\s*:\\s*"(${ids})"`),
  }
}

/** True when the stored execution was run for the seller. */
export const executionBelongsToSeller = (
  row: { context?: unknown; execution?: unknown },
  pattern: RegExp
): boolean => {
  const text = (value: unknown) =>
    typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "")

  return pattern.test(text(row.context)) || pattern.test(text(row.execution))
}
