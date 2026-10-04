"use client"

import { useState } from "react"
import { Textarea, toast } from "@medusajs/ui"
import { DocumentText } from "@medusajs/icons"
import { requestQuote } from "@lib/data/quotes"
import { convertToLocale } from "@lib/util/money"
import Modal from "@modules/common/components/modal"
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
  const currencyCode: string = cart?.currency_code || "usd"
  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: currencyCode })

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
      <button
        type="button"
        className="inline-flex h-11 w-full items-center justify-center rounded-large border-[1.5px] border-brand bg-card px-5 font-extrabold text-brand transition-colors hover:bg-brand-soft"
        onClick={() => setIsOpen(true)}
        data-testid="request-quote-button"
      >
        Request a Quote
      </button>

      <Modal isOpen={isOpen} close={() => setIsOpen(false)} size="medium">
        <div className="flex w-full flex-col gap-y-5 overflow-y-auto">
          <div className="flex items-start justify-between gap-x-3 border-b border-line pb-4">
            <div className="flex items-center gap-x-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-rounded bg-brand-soft text-brand">
                <DocumentText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
                  Request a Quote
                </h2>
                <p className="text-sm text-muted">
                  Submit your cart to the merchant for custom wholesale pricing.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="p-1 text-2xl leading-none text-muted transition-colors hover:text-ink"
            >
              &times;
            </button>
          </div>

          <form onSubmit={handleRequestQuote} className="flex flex-col gap-y-4">
            <div className="space-y-2 rounded-large border border-line bg-canvas p-4">
              <span className="block text-xs font-extrabold uppercase tracking-wider text-muted">
                Items in Quote ({items.length})
              </span>
              <div className="max-h-40 divide-y divide-line overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate font-bold text-ink">{item.title}</p>
                      <p className="text-muted">Qty: {item.quantity}</p>
                    </div>
                    <span className="whitespace-nowrap font-bold text-ink">
                      {money(
                        item.total
                          ? Number(item.total)
                          : Number(item.unit_price || 0) *
                              Number(item.quantity || 1)
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-sm font-extrabold text-ink">
                <span>Current Cart Total</span>
                <span>
                  {total > 0 ? money(total) : "Calculated at checkout"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="quote-note" className="text-sm font-bold text-ink">
                Message for Merchant (Optional)
              </label>
              <Textarea
                id="quote-note"
                rows={3}
                placeholder="e.g. Requesting bulk discount for quarterly procurement, or custom pricing..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="resize-none !rounded-rounded !border-line !bg-card !text-ink"
              />
            </div>

            <div className="flex items-center justify-end gap-x-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-large border-[1.5px] border-brand bg-card px-5 font-extrabold text-brand transition-colors hover:bg-brand-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-10 items-center justify-center rounded-large bg-brand px-5 font-extrabold text-brand-ink transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Submitting..." : "Submit Quote Request"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  )
}
