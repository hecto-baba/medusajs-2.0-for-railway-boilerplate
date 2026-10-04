type ApprovalLike = { statuses?: Array<{ status: string; created_at?: string | Date | null }> | null }

/**
 * A cart is approved only when the NEWEST decision on it is "approved".
 *
 * It used to count any "approved" in an approval's history, so a manager who
 * approved and then rejected the same request still let the order through.
 * Statuses with no timestamp sort first, so a dated decision always outranks them.
 */
export const isCartApproved = (approvals: ApprovalLike[] | null | undefined): boolean => {
  const decisions = (approvals ?? [])
    .flatMap((approval) => approval.statuses ?? [])
    .filter((entry) => entry && entry.status !== "pending")
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())

  return decisions[0]?.status === "approved"
}
