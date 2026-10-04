"use client"

import { useState } from "react"
import { updateApprovalStatus } from "@lib/data/company"

type ApprovalsListProps = {
  initialApprovals: any[]
}

export const ApprovalsList = ({ initialApprovals }: ApprovalsListProps) => {
  const [approvals, setApprovals] = useState(initialApprovals)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleAction = async (approvalId: string, status: "approved" | "rejected") => {
    setLoadingId(approvalId)
    setMessage(null)
    try {
      await updateApprovalStatus(approvalId, status)
      setApprovals((prev) =>
        prev.map((appr) => {
          if (appr.id === approvalId) {
            const statuses = appr.statuses || []
            return {
              ...appr,
              statuses: [...statuses, { status, type: "admin" }],
            }
          }
          return appr
        })
      )
      setMessage(`Order successfully ${status}.`)
    } catch (err: any) {
      setMessage(err.message || "Failed to update approval.")
    } finally {
      setLoadingId(null)
    }
  }

  if (approvals.length === 0) {
    return (
      <div className="rounded-large bg-card p-12 text-center shadow-lift">
        <p className="font-display text-lg font-extrabold tracking-tight mb-1">No Orders Pending Approval</p>
        <p className="text-sm text-muted">
          When employees place orders exceeding company spending rules, they will appear here for your review.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-4">
      {message && (
        <div className="rounded-large bg-brand-soft p-3 text-sm font-bold text-brand">
          {message}
        </div>
      )}

      {approvals.map((approval) => {
        const statuses = approval.statuses || []
        const latestStatus =
          statuses[statuses.length - 1]?.status || "pending"
        const customer = approval.cart?.customer || {}
        const employeeName =
          [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
          customer.email ||
          "Employee"
        const total = approval.cart?.total
          ? `${approval.cart.total} ${(approval.cart?.currency_code || "EUR").toUpperCase()}`
          : "—"

        return (
          <div
            key={approval.id}
            className="rounded-large bg-card p-5 shadow-lift flex flex-col small:flex-row small:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-x-3 mb-1">
                <span className="font-extrabold text-base">{employeeName}</span>
                <span
                  className={`rounded-circle px-2.5 py-1 text-xs font-bold leading-none ${
                    latestStatus === "approved"
                      ? "bg-success-soft text-success"
                      : latestStatus === "rejected"
                      ? "bg-brand-soft text-brand"
                      : "bg-pop text-pop-ink"
                  }`}
                >
                  {latestStatus.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-muted font-mono">
                Cart: {approval.cart_id}
              </p>
              <p className="text-sm font-bold mt-2">Order Total: {total}</p>
            </div>

            {latestStatus === "pending" && (
              <div className="flex items-center gap-x-2">
                <button
                  type="button"
                  onClick={() => handleAction(approval.id, "rejected")}
                  disabled={loadingId === approval.id}
                  className="px-4 py-2 text-sm font-bold border border-line bg-card rounded-large text-ink hover:bg-canvas disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(approval.id, "approved")}
                  disabled={loadingId === approval.id}
                  className="px-4 py-2 text-sm font-extrabold bg-brand text-brand-ink rounded-large hover:opacity-90 disabled:opacity-50"
                >
                  {loadingId === approval.id ? "Processing..." : "Approve Order"}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
