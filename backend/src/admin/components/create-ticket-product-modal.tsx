import { Button, FocusModal, Heading, ProgressTabs, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { sdk } from "../lib/sdk"
import {
  RowType,
  Venue,
  VenueListResponse,
  venueRowTypes,
} from "../types/ticket-booking"
import { ProductDetailsStep, ShowDetailsDraft } from "./product-details-step"
import { PricingDraft, PricingStep } from "./pricing-step"

const emptyDetails: ShowDetailsDraft = {
  name: "",
  description: "",
  venue_id: "",
  dates: [],
  range_start: "",
  range_end: "",
}

type CreateTicketProductModalProps = {
  onCreated: () => void
}

export const CreateTicketProductModal = ({
  onCreated,
}: CreateTicketProductModalProps) => {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"details" | "pricing">("details")
  const [details, setDetails] = useState<ShowDetailsDraft>(emptyDetails)
  const [pricing, setPricing] = useState<PricingDraft>({})

  const { data: venueData } = useQuery<VenueListResponse>({
    queryFn: () => sdk.client.fetch("/admin/venues", { query: { limit: 100 } }),
    queryKey: [["venues", "all"]],
    enabled: open,
  })

  const { data: storeData } = useQuery<{ stores: any[] }>({
    queryFn: () => sdk.client.fetch("/admin/stores"),
    queryKey: [["stores"]],
    enabled: open,
  })

  const venues: Venue[] = venueData?.venues ?? []

  const currencies: string[] = useMemo(() => {
    const supported = storeData?.stores?.[0]?.supported_currencies ?? []
    const codes = supported.map((currency: any) => currency.currency_code)
    return codes.length ? codes : ["usd"]
  }, [storeData])

  const selectedVenue = venues.find((venue) => venue.id === details.venue_id)
  const rowTypes = venueRowTypes(selectedVenue?.rows)

  const reset = () => {
    setDetails(emptyDetails)
    setPricing({})
    setTab("details")
  }

  const detailsError = (() => {
    if (!details.name.trim()) return "A show name is required"
    if (!details.venue_id) return "Select a venue"
    if (!details.dates.length) return "Pick at least one show date"
    return null
  })()

  const pricingError = (() => {
    const priced = rowTypes.filter((rowType) =>
      currencies.some((currency) => {
        const raw = pricing[rowType]?.[currency]
        return raw !== undefined && raw !== "" && Number(raw) >= 0
      })
    )
    if (!priced.length) return "Price at least one seating tier"
    return null
  })()

  const createMutation = useMutation({
    mutationFn: () => {
      // Only tiers with at least one price are sent; the backend rejects a
      // variant with no prices at all.
      const variants = rowTypes
        .map((rowType) => ({
          row_type: rowType,
          // Seats of this tier to put on sale per performance. Defaults to the
          // venue's capacity for the tier, which is the common case; the
          // backend takes it as given so a run can be sold at less than that.
          seat_count: (selectedVenue?.rows ?? [])
            .filter((row) => row.row_type === rowType)
            .reduce((total, row) => total + row.seat_count, 0),
          prices: currencies
            .map((currency) => ({
              currency_code: currency,
              amount: Number(pricing[rowType]?.[currency]),
            }))
            .filter(
              (price) =>
                Number.isFinite(price.amount) &&
                pricing[rowType]?.[price.currency_code] !== ""
            ),
        }))
        .filter((variant) => variant.prices.length > 0)

      return sdk.client.fetch("/admin/ticket-products", {
        method: "POST",
        body: {
          name: details.name.trim(),
          description: details.description.trim() || undefined,
          venue_id: details.venue_id,
          dates: details.dates,
          variants,
        },
      })
    },
    onSuccess: () => {
      toast.success(`Show "${details.name.trim()}" created`)
      reset()
      setOpen(false)
      onCreated()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not create the show")
    },
  })

  return (
    <FocusModal
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <FocusModal.Trigger asChild>
        <Button size="small" variant="secondary">
          Create show
        </Button>
      </FocusModal.Trigger>

      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex w-full items-center justify-end gap-2">
            {tab === "details" ? (
              <Button
                size="small"
                onClick={() => setTab("pricing")}
                disabled={!!detailsError}
              >
                Continue to pricing
              </Button>
            ) : (
              <>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setTab("details")}
                >
                  Back
                </Button>
                <Button
                  size="small"
                  onClick={() => createMutation.mutate()}
                  isLoading={createMutation.isPending}
                  disabled={!!detailsError || !!pricingError}
                >
                  Create show
                </Button>
              </>
            )}
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-10">
          <div className="flex w-full max-w-4xl flex-col gap-6 px-6">
            <div>
              <Heading level="h2">New show</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                A show becomes a product with one variant per date and seating
                tier, each stocked to that tier's seat count.
              </Text>
            </div>

            <ProgressTabs value={tab}>
              <ProgressTabs.List>
                <ProgressTabs.Trigger
                  value="details"
                  onClick={() => setTab("details")}
                  status={detailsError ? "not-started" : "completed"}
                >
                  Details
                </ProgressTabs.Trigger>
                <ProgressTabs.Trigger
                  value="pricing"
                  onClick={() => !detailsError && setTab("pricing")}
                  status={
                    detailsError
                      ? "not-started"
                      : pricingError
                        ? "in-progress"
                        : "completed"
                  }
                >
                  Pricing
                </ProgressTabs.Trigger>
              </ProgressTabs.List>
            </ProgressTabs>

            {tab === "details" ? (
              <ProductDetailsStep
                venues={venues}
                value={details}
                onChange={(patch) =>
                  setDetails((current) => ({ ...current, ...patch }))
                }
              />
            ) : (
              <PricingStep
                rowTypes={rowTypes as RowType[]}
                rows={selectedVenue?.rows ?? []}
                currencies={currencies}
                value={pricing}
                onChange={(rowType, currency, amount) =>
                  setPricing((current) => ({
                    ...current,
                    [rowType]: { ...current[rowType], [currency]: amount },
                  }))
                }
              />
            )}

            {tab === "details" && detailsError && (
              <Text size="small" className="text-ui-fg-error">
                {detailsError}
              </Text>
            )}
            {tab === "pricing" && pricingError && (
              <Text size="small" className="text-ui-fg-error">
                {pricingError}
              </Text>
            )}
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

export default CreateTicketProductModal
