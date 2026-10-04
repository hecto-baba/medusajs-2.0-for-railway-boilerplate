import { MedusaError } from "@medusajs/framework/utils"
import { createStep } from "@medusajs/framework/workflows-sdk"
import { InferTypeOf } from "@medusajs/framework/types"
import { Quote } from "../../modules/quote/models/quote"
import { canCustomerAcceptQuote, quoteStatusMessage } from "../../modules/quote/lib/transitions"

type StepInput = {
  quote: InferTypeOf<typeof Quote>
}

export const validateQuoteCanAcceptStep = createStep(
  "validate-quote-can-accept",
  async function ({ quote }: StepInput) {
    // Only a quote the seller has priced and sent can be accepted. It used to block
    // only an already-accepted quote, so an unpriced one could be accepted at the
    // buyer's original cart price.
    if (!canCustomerAcceptQuote(quote.status)) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, quoteStatusMessage(quote.status))
    }
  }
)
