"use client"

import { useState } from "react"
import { Button } from "@medusajs/ui"
import { submitCartForApproval } from "@lib/data/company"
import { useParams, useRouter } from "next/navigation"

type B2BApprovalButtonProps = {
  cartId: string
}

export const B2BApprovalButton = ({ cartId }: B2BApprovalButtonProps) => {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await submitCartForApproval(cartId)
      setSubmitted(true)
      setTimeout(() => {
        router.push(`/${countryCode}/account/company`)
      }, 2500)
    } catch (err: any) {
      setError(err.message || "Failed to submit for approval.")
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm mt-3">
        ✅ <strong>Order Submitted!</strong> This cart has been sent to your Company Manager for review and approval. Redirecting...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-2 mt-3">
      <Button
        variant="secondary"
        size="large"
        className="w-full border-blue-600 text-blue-700 hover:bg-blue-50 font-medium"
        onClick={handleSubmit}
        isLoading={submitting}
      >
        🛡️ Submit for Manager Approval
      </Button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
