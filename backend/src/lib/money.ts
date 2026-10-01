/**
 * Money helpers shared by the order splitter, the payout ledger and the seller
 * order actions.
 *
 * Amounts reach the code as plain numbers, numeric strings, or Medusa BigNumber
 * objects ({ numeric_ } / { value }); Number() on the object is NaN, so every
 * read of an amount goes through toNumber().
 */
export const toNumber = (value: any): number => {
  if (value === null || value === undefined) {
    return 0
  }
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "object") {
    return toNumber(value.numeric_ ?? value.value ?? value.raw_?.value)
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

/** Rounds to the currency's decimals (2 unless told otherwise). */
export const round = (value: number, decimals = 2): number => {
  const factor = Math.pow(10, decimals)
  return Math.round((value + Number.EPSILON) * factor) / factor
}
