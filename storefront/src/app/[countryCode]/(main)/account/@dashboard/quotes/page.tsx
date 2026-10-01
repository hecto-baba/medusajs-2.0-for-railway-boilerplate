import { listCustomerQuotes } from "@lib/data/quotes"
import { Heading, Text } from "@medusajs/ui"
import { QuotesList } from "@modules/account/components/quotes-list"

export default async function QuotesPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const quotes = await listCustomerQuotes()

  return (
    <div className="w-full flex flex-col gap-y-6">
      <div>
        <Heading level="h1" className="text-2xl-semi">
          Quotes
        </Heading>
        <Text className="text-ui-fg-subtle text-sm mt-1">
          Review negotiated bulk quotes, view revised merchant offers, and accept orders.
        </Text>
      </div>

      <QuotesList initialQuotes={quotes} countryCode={countryCode} />
    </div>
  )
}
