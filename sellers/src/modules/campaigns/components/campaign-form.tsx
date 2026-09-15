"use client"

import { createVendorCampaign } from "@lib/data/vendor-client"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  RadioGroup,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

const SUPPORTED_CURRENCIES = [
  { value: "usd", label: "USD - US Dollar" },
  { value: "eur", label: "EUR - Euro" },
  { value: "gbp", label: "GBP - British Pound" },
  { value: "inr", label: "INR - Indian Rupee" },
]

export const CampaignForm = () => {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [campaignIdentifier, setCampaignIdentifier] = useState("")
  const [description, setDescription] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [budgetType, setBudgetType] = useState<"usage" | "spend">("usage")
  const [budgetLimit, setBudgetLimit] = useState("")
  const [currencyCode, setCurrencyCode] = useState("usd")

  const { mutateAsync: createCampaign, isPending } = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createVendorCampaign(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-campaigns"] })
      toast.success(`Campaign "${data.campaign?.name || name}" created successfully.`)
      router.push(`/promotions/campaigns/${data.campaign?.id}`)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create campaign.")
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Please enter a campaign name.")
      return
    }

    if (!campaignIdentifier.trim()) {
      toast.error("Please enter a campaign identifier.")
      return
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      campaign_identifier: campaignIdentifier.trim().toLowerCase(),
      description: description.trim() || undefined,
      starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
      ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
    }

    if (budgetLimit) {
      const limitNum = Number(budgetLimit)
      if (isNaN(limitNum) || limitNum < 0) {
        toast.error("Budget limit must be a valid positive number.")
        return
      }
      payload.budget = {
        type: budgetType,
        limit: limitNum,
        currency_code: budgetType === "spend" ? currencyCode : undefined,
      }
    } else {
      payload.budget = {
        type: budgetType,
        currency_code: budgetType === "spend" ? currencyCode : undefined,
      }
    }

    await createCampaign(payload)
  }

  // Automatically suggest identifier from name if untouched
  const handleNameChange = (val: string) => {
    setName(val)
    if (!campaignIdentifier || campaignIdentifier === name.toLowerCase().replace(/[^a-z0-9]+/g, "-")) {
      setCampaignIdentifier(val.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-y-6 max-w-4xl mx-auto pb-16">
      <div className="flex items-center justify-between">
        <Link
          href="/promotions/campaigns"
          className="text-xs text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-1 font-semibold transition"
        >
          <span>←</span>
          <span>Back to Campaigns</span>
        </Link>
      </div>

      <Container className="p-6 bg-ui-bg-base border border-ui-border-base rounded-xl space-y-6">
        <div>
          <Heading level="h1" className="text-xl font-bold">
            Create Campaign
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Create a new campaign to group promotions and set shared budgets and schedules.
          </Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" size="small" weight="plus">
              Name <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Summer Sale 2026"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="identifier" size="small" weight="plus">
              Campaign Identifier <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              id="identifier"
              placeholder="e.g. summer-sale-2026"
              value={campaignIdentifier}
              onChange={(e) => setCampaignIdentifier(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" size="small" weight="plus">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="A short description of this campaign..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      </Container>

      {/* Schedule Configuration */}
      <Container className="p-6 bg-ui-bg-base border border-ui-border-base rounded-xl space-y-4">
        <div>
          <Heading level="h2" className="text-base font-semibold">
            Schedule Configuration
          </Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Optionally set when this campaign starts and expires.
          </Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="starts_at" size="small" weight="plus">
              Start Date
            </Label>
            <Input
              id="starts_at"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ends_at" size="small" weight="plus">
              End Date
            </Label>
            <Input
              id="ends_at"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>
      </Container>

      {/* Campaign Budget */}
      <Container className="p-6 bg-ui-bg-base border border-ui-border-base rounded-xl space-y-4">
        <div>
          <Heading level="h2" className="text-base font-semibold">
            Campaign Budget
          </Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Control the maximum spend or number of times promotions in this campaign can be redeemed.
          </Text>
        </div>

        <div className="space-y-3">
          <Label size="small" weight="plus">
            Budget Type
          </Label>
          <RadioGroup
            value={budgetType}
            onValueChange={(val: string) => setBudgetType(val as "usage" | "spend")}
            className="flex flex-col gap-y-2.5"
          >
            <div className="flex items-start gap-x-3 p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-base cursor-pointer transition">
              <RadioGroup.Item value="usage" id="type-usage" className="mt-0.5" />
              <div>
                <Label htmlFor="type-usage" className="font-semibold cursor-pointer">
                  Usage Limit
                </Label>
                <Text size="small" className="text-ui-fg-subtle">
                  Cap the total number of times promotions within this campaign can be used.
                </Text>
              </div>
            </div>

            <div className="flex items-start gap-x-3 p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-base cursor-pointer transition">
              <RadioGroup.Item value="spend" id="type-spend" className="mt-0.5" />
              <div>
                <Label htmlFor="type-spend" className="font-semibold cursor-pointer">
                  Spend Limit
                </Label>
                <Text size="small" className="text-ui-fg-subtle">
                  Cap the total monetary discount amount granted across all orders using this campaign.
                </Text>
              </div>
            </div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="limit" size="small" weight="plus">
              {budgetType === "spend" ? "Maximum Spend Amount" : "Maximum Number of Uses"}
            </Label>
            <Input
              id="limit"
              type="number"
              min="0"
              step="any"
              placeholder={budgetType === "spend" ? "e.g. 500.00" : "e.g. 100"}
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
            />
          </div>

          {budgetType === "spend" && (
            <div className="space-y-1.5">
              <Label htmlFor="currency" size="small" weight="plus">
                Currency
              </Label>
              <Select value={currencyCode} onValueChange={setCurrencyCode}>
                <Select.Trigger id="currency">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <Select.Item key={c.value} value={c.value}>
                      {c.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          )}
        </div>
      </Container>

      {/* Footer Controls */}
      <div className="flex items-center justify-end gap-x-3">
        <Link href="/promotions/campaigns">
          <Button variant="secondary" size="small" type="button">
            Cancel
          </Button>
        </Link>
        <Button variant="primary" size="small" type="submit" isLoading={isPending}>
          Create Campaign
        </Button>
      </div>
    </form>
  )
}
