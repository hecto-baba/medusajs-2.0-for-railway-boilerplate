"use client"

import { updateVendorCampaign, type VendorCampaign } from "@lib/data/vendor-client"
import {
  Button,
  FocusModal,
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
import { useState } from "react"

const SUPPORTED_CURRENCIES = [
  { value: "usd", label: "USD - US Dollar" },
  { value: "eur", label: "EUR - Euro" },
  { value: "gbp", label: "GBP - British Pound" },
  { value: "inr", label: "INR - Indian Rupee" },
]

export const EditCampaignGeneralModal = ({
  campaign,
  open,
  onOpenChange,
}: {
  campaign: VendorCampaign
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const queryClient = useQueryClient()
  const [name, setName] = useState(campaign.name)
  const [campaignIdentifier, setCampaignIdentifier] = useState(campaign.campaign_identifier)
  const [description, setDescription] = useState(campaign.description || "")

  const { mutateAsync: update, isPending } = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateVendorCampaign(campaign.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-campaigns"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-campaign", campaign.id] })
      toast.success("Campaign details updated.")
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update campaign.")
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Name is required.")
      return
    }
    await update({
      name: name.trim(),
      campaign_identifier: campaignIdentifier.trim().toLowerCase(),
      description: description.trim() || null,
    })
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <FocusModal.Header>
            <Heading level="h2" className="text-base font-semibold">
              Edit Campaign Details
            </Heading>
          </FocusModal.Header>
          <FocusModal.Body className="p-6 space-y-4 max-w-2xl mx-auto w-full">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" size="small" weight="plus">
                Name
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-identifier" size="small" weight="plus">
                Campaign Identifier
              </Label>
              <Input
                id="edit-identifier"
                value={campaignIdentifier}
                onChange={(e) => setCampaignIdentifier(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-description" size="small" weight="plus">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </FocusModal.Body>
          <div className="border-t border-ui-border-base p-4 flex items-center justify-end gap-x-2">
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="small" type="submit" isLoading={isPending}>
              Save
            </Button>
          </div>
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}

export const EditCampaignConfigurationModal = ({
  campaign,
  open,
  onOpenChange,
}: {
  campaign: VendorCampaign
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const queryClient = useQueryClient()
  const toInputDate = (d?: string | null) => (d ? d.slice(0, 16) : "")
  const [startsAt, setStartsAt] = useState(toInputDate(campaign.starts_at))
  const [endsAt, setEndsAt] = useState(toInputDate(campaign.ends_at))

  const { mutateAsync: update, isPending } = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateVendorCampaign(campaign.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-campaigns"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-campaign", campaign.id] })
      toast.success("Schedule configuration updated.")
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update configuration.")
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await update({
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    })
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <FocusModal.Header>
            <Heading level="h2" className="text-base font-semibold">
              Edit Schedule Configuration
            </Heading>
          </FocusModal.Header>
          <FocusModal.Body className="p-6 space-y-4 max-w-2xl mx-auto w-full">
            <div className="space-y-1.5">
              <Label htmlFor="edit-starts-at" size="small" weight="plus">
                Start Date
              </Label>
              <Input
                id="edit-starts-at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-ends-at" size="small" weight="plus">
                End Date
              </Label>
              <Input
                id="edit-ends-at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </FocusModal.Body>
          <div className="border-t border-ui-border-base p-4 flex items-center justify-end gap-x-2">
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="small" type="submit" isLoading={isPending}>
              Save
            </Button>
          </div>
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}

export const EditCampaignBudgetModal = ({
  campaign,
  open,
  onOpenChange,
}: {
  campaign: VendorCampaign
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const queryClient = useQueryClient()
  const [budgetType, setBudgetType] = useState<"usage" | "spend">(
    campaign.budget?.type === "spend" ? "spend" : "usage"
  )
  const [budgetLimit, setBudgetLimit] = useState(
    campaign.budget?.limit !== null && campaign.budget?.limit !== undefined
      ? String(campaign.budget.limit)
      : ""
  )
  const [currencyCode, setCurrencyCode] = useState(
    campaign.budget?.currency_code || "usd"
  )

  const { mutateAsync: update, isPending } = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateVendorCampaign(campaign.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-campaigns"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-campaign", campaign.id] })
      toast.success("Campaign budget updated.")
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update budget.")
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const limitNum = budgetLimit ? Number(budgetLimit) : undefined
    if (budgetLimit && (isNaN(limitNum!) || limitNum! < 0)) {
      toast.error("Please provide a valid positive budget limit.")
      return
    }

    await update({
      budget: {
        type: budgetType,
        limit: limitNum,
        currency_code: budgetType === "spend" ? currencyCode : undefined,
      },
    })
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <FocusModal.Header>
            <Heading level="h2" className="text-base font-semibold">
              Edit Campaign Budget
            </Heading>
          </FocusModal.Header>
          <FocusModal.Body className="p-6 space-y-4 max-w-2xl mx-auto w-full">
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
                  <RadioGroup.Item value="usage" id="edit-type-usage" className="mt-0.5" />
                  <div>
                    <Label htmlFor="edit-type-usage" className="font-semibold cursor-pointer">
                      Usage Limit
                    </Label>
                    <Text size="small" className="text-ui-fg-subtle">
                      Cap the total redemptions of promotions in this campaign.
                    </Text>
                  </div>
                </div>

                <div className="flex items-start gap-x-3 p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-base cursor-pointer transition">
                  <RadioGroup.Item value="spend" id="edit-type-spend" className="mt-0.5" />
                  <div>
                    <Label htmlFor="edit-type-spend" className="font-semibold cursor-pointer">
                      Spend Limit
                    </Label>
                    <Text size="small" className="text-ui-fg-subtle">
                      Cap the total monetary discount granted by promotions in this campaign.
                    </Text>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-limit" size="small" weight="plus">
                  {budgetType === "spend" ? "Maximum Spend Amount" : "Maximum Number of Uses"}
                </Label>
                <Input
                  id="edit-limit"
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
                  <Label htmlFor="edit-currency" size="small" weight="plus">
                    Currency
                  </Label>
                  <Select value={currencyCode} onValueChange={setCurrencyCode}>
                    <Select.Trigger id="edit-currency">
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
          </FocusModal.Body>
          <div className="border-t border-ui-border-base p-4 flex items-center justify-end gap-x-2">
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="small" type="submit" isLoading={isPending}>
              Save
            </Button>
          </div>
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}
