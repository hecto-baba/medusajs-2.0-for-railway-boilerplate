"use client"

import {
  createVendorShow,
  listVendorVenues,
  type VendorRowType,
  type VendorVenue,
} from "@lib/data/vendor-client"
import {
  ROW_TYPE_STYLES,
  SeatChart,
} from "@modules/venues/components/common/seat-chart"
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CurrencyDollar,
  Plus,
  Trash,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  DatePicker,
  FocusModal,
  Heading,
  Input,
  Label,
  ProgressTabs,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type ShowCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (showId: string) => void
}

type PricingDraft = Record<VendorRowType, Record<string, string>>

export const ShowCreateModal = ({
  open,
  onOpenChange,
  onSuccess,
}: ShowCreateModalProps) => {
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<"details" | "pricing">("details")

  // Step 1: Details & Dates
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [venueId, setVenueId] = useState("")
  const [dates, setDates] = useState<string[]>([])
  const [singleDate, setSingleDate] = useState<Date | null>(null)
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null)

  // Step 2: Pricing & Capacities
  const [pricing, setPricing] = useState<PricingDraft>({
    vip: { usd: "150" },
    premium: { usd: "100" },
    balcony: { usd: "75" },
    standard: { usd: "50" },
  })
  const [customCapacities, setCustomCapacities] = useState<
    Record<VendorRowType, number>
  >({} as any)
  const [currency] = useState("usd")

  // Fetch vendor venues
  const { data: venuesData, isLoading: isLoadingVenues } = useQuery({
    queryKey: ["vendor-venues", { limit: 100, offset: 0 }],
    queryFn: () => listVendorVenues({ limit: 100, offset: 0 }),
    enabled: open,
  })
  const venues = venuesData?.venues ?? []

  const selectedVenue = venues.find((v) => v.id === venueId)
  const venueRows = selectedVenue?.rows || []
  const venueTiers = useMemo(
    () => Array.from(new Set(venueRows.map((r) => r.row_type))),
    [venueRows]
  )

  const resetForm = () => {
    setName("")
    setDescription("")
    setVenueId("")
    setDates([])
    setSingleDate(null)
    setRangeStart(null)
    setRangeEnd(null)
    setTab("details")
  }

  const addSingleDate = () => {
    if (!singleDate) return
    const dateStr = singleDate.toISOString().split("T")[0]
    if (dates.includes(dateStr)) {
      toast.error("Date already added")
      return
    }
    setDates((prev) => [...prev, dateStr].sort())
    setSingleDate(null)
  }

  const addDateRange = () => {
    if (!rangeStart || !rangeEnd) {
      toast.error("Please pick both a start and end date")
      return
    }
    if (rangeEnd < rangeStart) {
      toast.error("End date cannot be before start date")
      return
    }

    const newDates: string[] = []
    const current = new Date(rangeStart)
    while (current <= rangeEnd) {
      const str = current.toISOString().split("T")[0]
      if (!dates.includes(str) && !newDates.includes(str)) {
        newDates.push(str)
      }
      current.setDate(current.getDate() + 1)
    }

    setDates((prev) => [...prev, ...newDates].sort())
    setRangeStart(null)
    setRangeEnd(null)
    toast.success(`Added ${newDates.length} performance dates`)
  }

  const removeDate = (dateToRemove: string) => {
    setDates((prev) => prev.filter((d) => d !== dateToRemove))
  }

  const detailsError = (() => {
    if (!name.trim()) return "A show name is required"
    if (!venueId) return "Please select a venue"
    if (!dates.length) return "Please add at least one performance date"
    return null
  })()

  const pricingError = (() => {
    if (!venueTiers.length) return "Venue has no seating rows configured"
    const hasPricedTier = venueTiers.some((tier) => {
      const val = pricing[tier]?.[currency]
      return val !== undefined && val !== "" && Number(val) >= 0
    })
    if (!hasPricedTier) return "Please set a price for at least one seating tier"
    return null
  })()

  const createMutation = useMutation({
    mutationFn: () => {
      const variants = venueTiers
        .map((rowType) => {
          const defaultCapacity = venueRows
            .filter((r) => r.row_type === rowType)
            .reduce((sum, r) => sum + (r.seat_count || 0), 0)

          const seatCount = customCapacities[rowType] ?? defaultCapacity
          const priceAmount = Number(pricing[rowType]?.[currency] ?? 0)

          return {
            row_type: rowType,
            seat_count: seatCount,
            prices: [
              {
                currency_code: currency.toLowerCase(),
                amount: Math.round(priceAmount * 100), // convert to cents
              },
            ],
          }
        })
        .filter((v) => v.prices[0].amount >= 0 && v.seat_count > 0)

      return createVendorShow({
        name: name.trim(),
        description: description.trim() || undefined,
        venue_id: venueId,
        dates,
        variants,
      })
    },
    onSuccess: (data) => {
      toast.success(`Show "${name.trim()}" created successfully`)
      queryClient.invalidateQueries({ queryKey: ["vendor-shows"] })
      onOpenChange(false)
      const createdId = data.show.id
      resetForm()
      onSuccess?.(createdId)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create show")
    },
  })

  const handleSubmit = () => {
    if (detailsError) {
      setTab("details")
      toast.error(detailsError)
      return
    }
    if (pricingError) {
      setTab("pricing")
      toast.error(pricingError)
      return
    }

    createMutation.mutate()
  }

  return (
    <FocusModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm()
        onOpenChange(nextOpen)
      }}
    >
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Create Show</Heading>
            </FocusModal.Title>
            <FocusModal.Description asChild>
              <Text size="small" className="text-ui-fg-subtle">
                Publish a ticketed event with performance dates and tier pricing.
              </Text>
            </FocusModal.Description>
          </div>

          <div className="flex items-center gap-x-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>

            {tab === "details" ? (
              <Button
                variant="primary"
                size="small"
                onClick={() => {
                  if (detailsError) {
                    toast.error(detailsError)
                    return
                  }
                  setTab("pricing")
                }}
              >
                Next: Pricing & Tiers
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setTab("details")}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleSubmit}
                  isLoading={createMutation.isPending}
                >
                  Publish Show
                </Button>
              </>
            )}
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 flex-col overflow-y-auto">
          <ProgressTabs
            value={tab}
            onValueChange={(val: any) => setTab(val)}
            className="flex flex-col flex-1"
          >
            <ProgressTabs.List className="border-b px-6">
              <ProgressTabs.Trigger value="details">
                1. Details & Dates
              </ProgressTabs.Trigger>
              <ProgressTabs.Trigger value="pricing" disabled={!!detailsError}>
                2. Seating Tiers & Pricing
              </ProgressTabs.Trigger>
            </ProgressTabs.List>

            {/* Step 1: Details & Performance Dates */}
            <ProgressTabs.Content
              value="details"
              className="flex-1 p-6 max-w-4xl mx-auto w-full flex flex-col gap-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Show Details */}
                <div className="flex flex-col gap-y-4">
                  <Heading level="h3">Show Information</Heading>

                  <div className="flex flex-col gap-y-2">
                    <Label size="small" weight="plus">
                      Show Title <span className="text-ui-fg-error">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Shakespeare in the Park, Rock Fest"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-y-2">
                    <Label size="small" weight="plus">
                      Description
                    </Label>
                    <Textarea
                      placeholder="Brief description of the performance..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="flex flex-col gap-y-2">
                    <Label size="small" weight="plus">
                      Performance Venue <span className="text-ui-fg-error">*</span>
                    </Label>
                    {isLoadingVenues ? (
                      <Text size="small" className="text-ui-fg-subtle">
                        Loading venues...
                      </Text>
                    ) : venues.length === 0 ? (
                      <div className="bg-ui-bg-subtle p-3 rounded-lg border border-dashed text-center">
                        <Text size="small" className="text-ui-fg-subtle">
                          No venues found. Please create a venue first.
                        </Text>
                      </div>
                    ) : (
                      <Select
                        value={venueId}
                        onValueChange={(val) => {
                          setVenueId(val)
                        }}
                      >
                        <Select.Trigger>
                          <Select.Value placeholder="Select a venue" />
                        </Select.Trigger>
                        <Select.Content>
                          {venues.map((v) => (
                            <Select.Item key={v.id} value={v.id}>
                              {v.name} ({v.total_seats ?? (v.rows || []).reduce((sum, r) => sum + (r.seat_count || 0), 0)} seats)
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Performance Dates */}
                <div className="flex flex-col gap-y-4">
                  <Heading level="h3">Performance Schedule</Heading>

                  {/* Add Individual Date */}
                  <div className="flex flex-col gap-y-2 bg-ui-bg-subtle p-3 rounded-lg border border-ui-border-base">
                    <Label size="small" weight="plus">
                      Add Single Performance Date
                    </Label>
                    <div className="flex items-center gap-2">
                      <DatePicker
                        value={singleDate}
                        onChange={setSingleDate}
                      />
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={addSingleDate}
                        disabled={!singleDate}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Add Date Range Generator */}
                  <div className="flex flex-col gap-y-2 bg-ui-bg-subtle p-3 rounded-lg border border-ui-border-base">
                    <Label size="small" weight="plus">
                      Or Generate Consecutive Run
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Text size="xsmall" className="text-ui-fg-subtle mb-1">
                          Start Date
                        </Text>
                        <DatePicker
                          value={rangeStart}
                          onChange={setRangeStart}
                        />
                      </div>
                      <div>
                        <Text size="xsmall" className="text-ui-fg-subtle mb-1">
                          End Date
                        </Text>
                        <DatePicker
                          value={rangeEnd}
                          onChange={setRangeEnd}
                        />
                      </div>
                    </div>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={addDateRange}
                      disabled={!rangeStart || !rangeEnd}
                      className="mt-1"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Run Dates
                    </Button>
                  </div>

                  {/* Selected Dates Chips */}
                  <div className="flex flex-col gap-y-2">
                    <div className="flex items-center justify-between">
                      <Label size="small" weight="plus">
                        Scheduled Dates ({dates.length})
                      </Label>
                      {dates.length > 0 && (
                        <Button
                          size="small"
                          variant="transparent"
                          onClick={() => setDates([])}
                          className="text-ui-fg-error"
                        >
                          Clear All
                        </Button>
                      )}
                    </div>

                    {dates.length === 0 ? (
                      <div className="p-4 border border-dashed rounded-lg text-center text-ui-fg-subtle text-xs">
                        No dates added yet. Pick a single date or date range above.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                        {dates.map((d) => (
                          <div
                            key={d}
                            className="flex items-center gap-1.5 bg-ui-bg-base px-2.5 py-1 rounded-md border text-xs font-medium"
                          >
                            <Calendar className="h-3.5 w-3.5 text-ui-fg-subtle" />
                            <span>
                              {new Date(d).toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeDate(d)}
                              className="text-ui-fg-muted hover:text-ui-fg-error ml-1"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ProgressTabs.Content>

            {/* Step 2: Tier Pricing & Capacity */}
            <ProgressTabs.Content
              value="pricing"
              className="flex-1 p-6 max-w-5xl mx-auto w-full flex flex-col gap-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pricing Inputs */}
                <div className="flex flex-col gap-y-4">
                  <div>
                    <Heading level="h3">Seating Tiers & Pricing</Heading>
                    <Text size="small" className="text-ui-fg-subtle">
                      Define ticket prices for each seating tier at &ldquo;{selectedVenue?.name}&rdquo;.
                    </Text>
                  </div>

                  <div className="flex flex-col gap-y-3">
                    {venueTiers.map((tier) => {
                      const style =
                        ROW_TYPE_STYLES[tier] ?? ROW_TYPE_STYLES.standard
                      const tierTotalSeats = venueRows
                        .filter((r) => r.row_type === tier)
                        .reduce((sum, r) => sum + (r.seat_count || 0), 0)

                      return (
                        <div
                          key={tier}
                          className="bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base flex flex-col gap-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge size="small" color={style.badgeColor}>
                                {style.label}
                              </Badge>
                              <Text size="xsmall" className="text-ui-fg-subtle">
                                {tierTotalSeats} seats in venue
                              </Text>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-y-1">
                              <Label size="xsmall" className="text-ui-fg-subtle">
                                Price ({currency.toUpperCase()})
                              </Label>
                              <div className="relative">
                                <CurrencyDollar className="absolute left-2.5 top-2.5 h-4 w-4 text-ui-fg-muted" />
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  placeholder="0.00"
                                  className="pl-8"
                                  value={pricing[tier]?.[currency] ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setPricing((prev) => ({
                                      ...prev,
                                      [tier]: {
                                        ...prev[tier],
                                        [currency]: val,
                                      },
                                    }))
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex flex-col gap-y-1">
                              <Label size="xsmall" className="text-ui-fg-subtle">
                                Seats on Sale per Run
                              </Label>
                              <Input
                                type="number"
                                min={1}
                                max={tierTotalSeats}
                                value={
                                  customCapacities[tier] ?? tierTotalSeats
                                }
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0
                                  setCustomCapacities((prev) => ({
                                    ...prev,
                                    [tier]: val,
                                  }))
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Live Seating Plan Preview */}
                <div className="flex flex-col gap-y-3">
                  <Heading level="h3">Venue Seating Layout</Heading>
                  <SeatChart rows={venueRows} />
                </div>
              </div>
            </ProgressTabs.Content>
          </ProgressTabs>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
