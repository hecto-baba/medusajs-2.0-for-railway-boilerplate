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
      <div className="border border-dashed rounded-lg p-12 text-center bg-gray-50">
        <p className="text-base-semi mb-1">No Orders Pending Approval</p>
        <p className="text-sm text-ui-fg-subtle">
          When employees place orders exceeding company spending rules, they will appear here for your review.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-4">
      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded text-sm">
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
            className="border rounded-lg p-6 bg-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-x-3 mb-1">
                <span className="font-semibold text-base">{employeeName}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    latestStatus === "approved"
                      ? "bg-green-100 text-green-800"
                      : latestStatus === "rejected"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {latestStatus.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-ui-fg-subtle font-mono">
                Cart: {approval.cart_id}
              </p>
              <p className="text-sm font-medium mt-2">Order Total: {total}</p>
            </div>

            {latestStatus === "pending" && (
              <div className="flex items-center gap-x-2">
                <button
                  type="button"
                  onClick={() => handleAction(approval.id, "rejected")}
                  disabled={loadingId === approval.id}
                  className="px-4 py-2 text-sm border rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(approval.id, "approved")}
                  disabled={loadingId === approval.id}
                  className="px-4 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
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
