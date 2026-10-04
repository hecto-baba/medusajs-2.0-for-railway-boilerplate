/**
 * Standard Medusa 2.0 Date Filter helper
 * Replicates the exact date filter presets ("Today", "Last 7 days", "Last 30 days", "Last 90 days")
 * used in official Medusa 2.0 Admin Dashboard (@medusajs/dashboard).
 */

export const getDateFilterPresets = () => [
  {
    label: "Today",
    value: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
      $lte: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
    },
  },
  {
    label: "Last 7 days",
    value: {
      $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    label: "Last 30 days",
    value: {
      $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    label: "Last 90 days",
    value: {
      $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
]

export const createMedusaDateFilter = (
  filterHelper: any,
  key: "created_at" | "updated_at",
  label: string
) => {
  return filterHelper.accessor(key, {
    type: "date",
    label,
    options: getDateFilterPresets(),
  })
}

export const resolveMedusaDateFilter = (val: any): string | undefined => {
  if (!val || val === "all") return undefined
  if (typeof val === "object") {
    if (val.$gte) {
      return typeof val.$gte === "string" ? val.$gte : new Date(val.$gte).toISOString()
    }
    const flat = Object.values(val).flat()
    val = flat[0]
  }
  if (Array.isArray(val)) val = val[0]
  if (typeof val !== "string" || val === "all") return undefined
  if (val === "7d") {
    const now = new Date()
    now.setDate(now.getDate() - 7)
    return now.toISOString()
  }
  if (val === "30d") {
    const now = new Date()
    now.setDate(now.getDate() - 30)
    return now.toISOString()
  }
  if (val === "90d") {
    const now = new Date()
    now.setDate(now.getDate() - 90)
    return now.toISOString()
  }
  if (!isNaN(Date.parse(val))) {
    return new Date(val).toISOString()
  }
  return undefined
}
