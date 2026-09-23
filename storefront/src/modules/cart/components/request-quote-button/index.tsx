"use client"

import { useState } from "react"
import { Button, Heading, Label, Textarea, toast } from "@medusajs/ui"
import { DocumentText } from "@medusajs/icons"
import { requestQuote } from "@lib/data/quotes"
import { useRouter } from "next/navigation"

type RequestQuoteButtonProps = {
  cart?: any
  cartId?: string
}

export const RequestQuoteButton = ({ cart, cartId }: RequestQuoteButtonProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState("")
  const router = useRouter()

  const resolvedCartId = cart?.id || cartId
  const items: any[] = cart?.items || []
  const total = Number(cart?.total || 0)

  const handleRequestQuote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvedCartId) {
      toast.error("Cart not found")
      return
    }

    setLoading(true)
    try {
      const res = await requestQuote({
        cartId: resolvedCartId,
        note: note.trim() || undefined,
      })

      if (res.success) {
        toast.success("Quote Requested Successfully", {
          description: "Your quote request has been submitted to the merchant for review.",
        })
        setIsOpen(false)
        router.push("/account/quotes")
      } else {
        toast.error("Quote Error", {
          description: res.error || "Failed to submit quote. Please ensure you are logged in.",
        })
      }
    } catch (err: any) {
      toast.error("Error", { description: err.message || "Failed to submit quote" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        className="w-full h-10"
        onClick={() => setIsOpen(true)}
      >
        Request a Quote
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-gray-200 p-6 flex flex-col gap-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                  <DocumentText className="w-5 h-5" />
                </div>
                <div>
                  <Heading level="h2" className="text-base font-semibold text-ui-fg-base">
                    Request a Quote
                  </Heading>
                  <p className="text-xs text-ui-fg-subtle">
                    Submit your cart to the merchant for custom wholesale pricing.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-ui-fg-muted hover:text-ui-fg-base text-2xl leading-none p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRequestQuote} className="flex flex-col gap-y-4">
              {/* Items Summary */}
              <div className="border rounded-xl p-3 bg-gray-50/70 space-y-2">
                <span className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider block">
                  Items in Quote ({items.length})
                </span>
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {items.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-medium text-ui-fg-base truncate">{item.title}</p>
                        <p className="text-ui-fg-subtle">Qty: {item.quantity}</p>
                      </div>
                      <span className="font-mono text-ui-fg-base whitespace-nowrap">
                        {item.total ? `€${(Number(item.total) / 100).toFixed(2)}` : `€${(Number(item.unit_price || 0) * Number(item.quantity || 1)).toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 flex justify-between text-xs font-semibold text-ui-fg-base">
                  <span>Current Cart Total</span>
                  <span className="font-mono">
                    {total > 0 ? `€${(total / 100).toFixed(2)}` : "Calculated at checkout"}
                  </span>
                </div>
              </div>

              {/* Optional Customer Note / Message */}
              <div className="space-y-1.5">
                <Label htmlFor="quote-note" className="text-xs font-medium text-ui-fg-base">
                  Message for Merchant (Optional)
                </Label>
                <Textarea
                  id="quote-note"
                  rows={3}
                  placeholder="e.g. Requesting bulk discount for quarterly procurement, or custom pricing..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="text-xs resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-x-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="small"
                  isLoading={loading}
                >
                  Submit Quote Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
