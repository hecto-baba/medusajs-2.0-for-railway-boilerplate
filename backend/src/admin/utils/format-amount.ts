export const formatAmount = (amount?: number | null, currency_code: string = "EUR") => {
  if (typeof amount === "undefined" || amount === null) {
    return "-"
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency_code ? currency_code.toUpperCase() : "EUR",
  }).format(amount)
}
