import type { AdminOrder } from "@medusajs/framework/types"
import { Button, Heading, toast } from "@medusajs/ui"
import { useConfirmQuote } from "../hooks/quotes"
import { formatAmount } from "../utils/format-amount"
import { useOrderPreview } from "../hooks/order-preview"
import { useNavigate, useParams } from "react-router-dom"
import { useMemo } from "react"
import { ManageItem } from "./manage-item"

type ReturnCreateFormProps = {
  order: AdminOrder
}

export const ManageQuoteForm = ({ order }: ReturnCreateFormProps) => {
  const { order: preview } = useOrderPreview(order.id)
  const navigate = useNavigate()
  const { id: quoteId } = useParams()
  const { mutateAsync: confirmQuote, isPending: isRequesting } = useConfirmQuote(
    order.id
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      await confirmQuote()
      navigate(`/quotes/${quoteId}`)
      toast.success("Successfully updated quote")
    } catch (e: any) {
      toast.error("Error", {
        description: e?.message || "Failed to confirm quote edit",
      })
    }
  }

  const originalItemsMap = useMemo(() => {
    return new Map((order?.items || []).map((item) => [item.id, item]))
  }, [order])

  if (!preview) {
    return (
      <div className="p-8 text-center text-ui-fg-subtle">
        Loading order preview items...
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col p-6 gap-4">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <Heading level="h2" className="text-base font-semibold">
            Quote Items
          </Heading>
          <span className="text-xs text-ui-fg-subtle">
            Adjust quantities and custom unit prices
          </span>
        </div>
        {(preview.items || []).map((item: any) => (
          <ManageItem
            key={item.id}
            originalItem={originalItemsMap.get(item.id)!}
            item={item}
            orderId={order.id}
            currencyCode={order.currency_code}
          />
        ))}
      </div>

      <div className="mt-6 border-y border-dashed py-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="txt-small text-ui-fg-subtle">Current Total</span>
          <span className="txt-small font-mono text-ui-fg-subtle">
            {formatAmount(order.total, order.currency_code)}
          </span>
        </div>
        <div className="flex items-center justify-between font-semibold text-base text-ui-fg-base">
          <span>New Quote Total</span>
          <span className="font-mono text-ui-fg-interactive">
            {formatAmount(preview.total, order.currency_code)}
          </span>
        </div>
      </div>

      <div className="flex w-full items-center justify-end gap-x-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={() => navigate(`/quotes/${quoteId}`)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="small"
          isLoading={isRequesting}
        >
          Confirm Edit
        </Button>
      </div>
    </form>
  )
}
