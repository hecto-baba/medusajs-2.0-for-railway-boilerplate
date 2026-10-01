import {
  confirmOrderEditRequestWorkflow,
  emitEventStep,
  updateOrderWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { OrderStatus } from "@medusajs/framework/utils"
import { createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { validateQuoteCanAcceptStep } from "./steps/validate-quote-can-accept"
import { QuoteStatus } from "../modules/quote/models/quote"
import { updateQuotesStep } from "./steps/update-quotes"

type WorkflowInput = {
  quote_id: string
  customer_id?: string
}

export const customerAcceptQuoteWorkflow = createWorkflow(
  "customer-accept-quote-workflow",
  (input: WorkflowInput) => {
    const { data: quotes } = useQueryGraphStep({
      entity: "quote",
      fields: ["id", "draft_order_id", "status", "customer_id"],
      filters: { id: input.quote_id },
      options: {
        throwIfKeyNotFound: true,
      },
    })

    validateQuoteCanAcceptStep({
      // @ts-ignore
      quote: quotes[0],
    })

    updateQuotesStep([
      {
        id: input.quote_id,
        status: QuoteStatus.ACCEPTED,
      },
    ])

    confirmOrderEditRequestWorkflow.runAsStep({
      input: {
        order_id: quotes[0].draft_order_id,
        confirmed_by: input.customer_id || "customer",
      },
    })

    updateOrderWorkflow.runAsStep({
      input: {
        id: quotes[0].draft_order_id,
        // @ts-ignore
        status: OrderStatus.PENDING,
        is_draft_order: false,
      },
    })

    // An accepted quote becomes a real order but never went through cart
    // completion, so nothing announced it: no buyer confirmation, and no seller
    // ever got the order. Announce it like any placed order; the seller-order
    // subscriber then links or splits it.
    emitEventStep({
      eventName: "order.placed",
      data: transform({ quotes }, (data) => ({ id: data.quotes[0].draft_order_id })),
    }).config({ name: "emit-order-placed-for-accepted-quote" })
  }
)
