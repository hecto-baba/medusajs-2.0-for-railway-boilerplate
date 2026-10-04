import { MedusaError } from "@medusajs/framework/utils"
import { createStep } from "@medusajs/framework/workflows-sdk"
import { InferTypeOf } from "@medusajs/framework/types"
import { Quote } from "../../modules/quote/models/quote"
import { canDeclineQuote, quoteStatusMessage } from "../../modules/quote/lib/transitions"

type StepInput = {
  quote: InferTypeOf<typeof Quote>
}

export const validateQuoteNotAccepted = createStep(
  "validate-quote-not-accepted",
  async function ({ quote }: StepInput) {
    // A decided quote (accepted or declined) is final. Only the accepted case used
    // to be blocked, so a declined quote could be reopened, or an accepted one
    // declined later by the other route.
    if (!canDeclineQuote(quote.status)) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, quoteStatusMessage(quote.status))
    }
  }
)
