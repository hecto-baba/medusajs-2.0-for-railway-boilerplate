/**
 * Resolves a TrustClaw category (by code or trustclaw_id) to the corresponding Medusa product_category id.
 */
export async function resolveMedusaCategory(
  trustclawCategoryCode?: string | null,
  trustclawCategoryId?: string | null
): Promise<string | null> {
  if (!trustclawCategoryCode && !trustclawCategoryId) return null

  try {
    const res = await fetch(
      `/api/vendors/taxonomy/tc-categories?limit=500`
    )
    if (!res.ok) return null
    const data = await res.json()
    const categories = data.categories || []

    // 1. First check if categories returned medusa_id
    const match = categories.find(
      (c: any) =>
        (trustclawCategoryId && (c.id === trustclawCategoryId || c.metadata?.trustclaw_id === trustclawCategoryId)) ||
        (trustclawCategoryCode && (c.code === trustclawCategoryCode || c.metadata?.trustclaw_code === trustclawCategoryCode))
    )

    if (match) {
      if (match.medusa_id) return match.medusa_id
      if (match.id && match.id.startsWith("pcat_")) return match.id
    }

    // 2. Query vendor taxonomy for matching category
    const taxRes = await fetch(`/api/vendors/taxonomy`)
    if (taxRes.ok) {
      const taxData = await taxRes.json()
      const medusaMatch = (taxData.categories || []).find(
        (mc: any) =>
          (trustclawCategoryId && mc.metadata?.trustclaw_id === trustclawCategoryId) ||
          (trustclawCategoryCode && mc.metadata?.trustclaw_code === trustclawCategoryCode)
      )
      if (medusaMatch) return medusaMatch.id
    }

    return null
  } catch (err) {
    console.warn("Failed to resolve Medusa category:", trustclawCategoryCode, err)
    return null
  }
}
