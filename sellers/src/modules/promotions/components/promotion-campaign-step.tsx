"use client"

import { listVendorCampaigns, type VendorCampaign } from "@lib/data/vendor-client"
import { Input, Label, RadioGroup, Select, Text, Textarea } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"

export type NewCampaignDraft = {
  name: string
  campaign_identifier: string
  description: string
  starts_at: string
  ends_at: string
  budget_type: "usage" | "spend"
  budget_limit: string
  budget_currency_code: string
}

export const DEFAULT_NEW_CAMPAIGN: NewCampaignDraft = {
  name: "",
  campaign_identifier: "",
  description: "",
  starts_at: "",
  ends_at: "",
  budget_type: "usage",
  budget_limit: "",
  budget_currency_code: "",
}

export type CampaignChoice = "none" | "existing" | "new"

type PromotionCampaignStepProps = {
  choice: CampaignChoice
  onChoiceChange: (choice: CampaignChoice) => void
  existingCampaignId: string | null
  onExistingCampaignChange: (id: string | null) => void
  newCampaign: NewCampaignDraft
  onNewCampaignChange: (draft: NewCampaignDraft) => void
  /**
   * The promotion's own currency, when it has one (fixed-amount promotions
   * only - percentage promotions carry no currency). A spend-type budget only
   * makes sense in the same currency as the promotion it caps, so a new
   * campaign's currency is locked to this rather than freely editable, and an
   * existing campaign whose budget currency does not match is disabled - the
   * same two rules the admin's campaign picker enforces.
   */
  promotionCurrencyCode?: string
}

const Field = ({
  id,
  label,
  hint,
  children,
}: {
  id?: string
  label: string
  hint?: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-y-2">
    <Label htmlFor={id} size="small" weight="plus">
      {label}
    </Label>
    {children}
    {hint ? (
      <Text size="small" className="text-ui-fg-subtle">
        {hint}
      </Text>
    ) : null}
  </div>
)

const CampaignSummary = ({ campaign }: { campaign: VendorCampaign }) => (
  <div className="bg-ui-bg-subtle flex flex-col gap-y-1 rounded-md p-4">
    <Text size="small" weight="plus">
      {campaign.campaign_identifier}
    </Text>
    {campaign.description && (
      <Text size="small" className="text-ui-fg-subtle">
        {campaign.description}
      </Text>
    )}
    {campaign.budget && (
      <Text size="small" className="text-ui-fg-subtle">
        Budget: {campaign.budget.type}
        {campaign.budget.limit ? ` · limit ${campaign.budget.limit}` : ""}
        {campaign.budget.currency_code
          ? ` ${campaign.budget.currency_code.toUpperCase()}`
          : ""}
      </Text>
    )}
  </div>
)

/**
 * Only campaigns this vendor created themselves can ever be listed here -
 * listVendorCampaigns is scoped server-side, and there is no route that lets
 * a vendor attach to a campaign it did not create (see
 * backend/src/links/vendor-campaign.ts). That is what makes "existing"
 * safe to offer at all: the admin's own campaign picker browses every
 * campaign in the store, which a vendor must never be able to do.
 */
export const PromotionCampaignStep = ({
  choice,
  onChoiceChange,
  existingCampaignId,
  onExistingCampaignChange,
  newCampaign,
  onNewCampaignChange,
  promotionCurrencyCode,
}: PromotionCampaignStepProps) => {
  const { data } = useQuery({
    queryKey: ["vendor-campaigns-picker"],
    queryFn: () => listVendorCampaigns({ limit: 100, offset: 0 }),
    enabled: choice === "existing",
  })

  const campaigns = data?.campaigns ?? []
  const selected = campaigns.find((campaign) => campaign.id === existingCampaignId)

  const currencyMismatch = (campaign: VendorCampaign) =>
    Boolean(
      promotionCurrencyCode &&
        campaign.budget?.type === "spend" &&
        campaign.budget.currency_code &&
        campaign.budget.currency_code !== promotionCurrencyCode
    )

  const set = (patch: Partial<NewCampaignDraft>) =>
    onNewCampaignChange({ ...newCampaign, ...patch })

  return (
    <div className="flex flex-col gap-y-6">
      <RadioGroup
        value={choice}
        onValueChange={(value) => onChoiceChange(value as CampaignChoice)}
      >
        <RadioGroup.ChoiceBox
          value="none"
          label="No campaign"
          description="Don't add this promotion to a campaign."
        />
        <RadioGroup.ChoiceBox
          value="existing"
          label="Add to an existing campaign"
          description="Choose one of your own campaigns."
        />
        <RadioGroup.ChoiceBox
          value="new"
          label="Create a new campaign"
          description="Group this promotion under a new campaign."
        />
      </RadioGroup>

      {choice === "existing" && (
        <div className="flex flex-col gap-y-4">
          <Field label="Campaign">
            <Select
              value={existingCampaignId ?? undefined}
              onValueChange={(value) => onExistingCampaignChange(value)}
            >
              <Select.Trigger>
                <Select.Value placeholder="Select a campaign" />
              </Select.Trigger>
              <Select.Content>
                {campaigns.map((campaign) => (
                  <Select.Item
                    key={campaign.id}
                    value={campaign.id}
                    disabled={currencyMismatch(campaign)}
                  >
                    {campaign.name}
                    {currencyMismatch(campaign)
                      ? ` (${campaign.budget?.currency_code?.toUpperCase()} budget)`
                      : ""}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>

          {!campaigns.length && (
            <Text size="small" className="text-ui-fg-subtle">
              You don&apos;t have any campaigns yet. Create one instead.
            </Text>
          )}

          {Boolean(campaigns.length) && promotionCurrencyCode && (
            <Text size="small" className="text-ui-fg-subtle">
              Campaigns with a spend budget in a different currency than this
              promotion ({promotionCurrencyCode.toUpperCase()}) are disabled.
            </Text>
          )}

          {selected && <CampaignSummary campaign={selected} />}
        </div>
      )}

      {choice === "new" && (
        <div className="flex flex-col gap-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="campaign_name" label="Name">
              <Input
                id="campaign_name"
                value={newCampaign.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Summer Sale 2026"
              />
            </Field>

            <Field id="campaign_identifier" label="Identifier">
              <Input
                id="campaign_identifier"
                value={newCampaign.campaign_identifier}
                onChange={(e) => set({ campaign_identifier: e.target.value })}
                placeholder="summer-sale-2026"
              />
            </Field>
          </div>

          <Field id="campaign_description" label="Description" hint="Optional.">
            <Textarea
              id="campaign_description"
              rows={3}
              value={newCampaign.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="campaign_starts_at" label="Start date" hint="Optional.">
              <Input
                id="campaign_starts_at"
                type="date"
                value={newCampaign.starts_at}
                onChange={(e) => set({ starts_at: e.target.value })}
              />
            </Field>

            <Field id="campaign_ends_at" label="End date" hint="Optional.">
              <Input
                id="campaign_ends_at"
                type="date"
                value={newCampaign.ends_at}
                onChange={(e) => set({ ends_at: e.target.value })}
              />
            </Field>
          </div>

          <Field
            label="Budget type"
            hint="Usage limits the number of times the campaign's promotions can be used; Spend limits the total amount they can discount."
          >
            <RadioGroup
              value={newCampaign.budget_type}
              onValueChange={(value) =>
                set({ budget_type: value as "usage" | "spend" })
              }
            >
              <RadioGroup.ChoiceBox
                value="usage"
                label="Usage"
                description="Applies to the number of times the promotion is used."
              />
              <RadioGroup.ChoiceBox
                value="spend"
                label="Spend"
                description="Applies to the total amount discounted."
              />
            </RadioGroup>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {newCampaign.budget_type === "spend" && (
              <Field
                id="campaign_budget_currency"
                label="Currency"
                hint={
                  promotionCurrencyCode
                    ? "Matches this promotion's currency."
                    : "This promotion has no fixed currency to match - set one on the Details tab, or enter a currency here."
                }
              >
                <Input
                  id="campaign_budget_currency"
                  value={promotionCurrencyCode ?? newCampaign.budget_currency_code}
                  onChange={(e) =>
                    set({ budget_currency_code: e.target.value.toLowerCase() })
                  }
                  placeholder="eur"
                  disabled={Boolean(promotionCurrencyCode)}
                />
              </Field>
            )}

            <Field id="campaign_budget_limit" label="Limit" hint="Optional.">
              <Input
                id="campaign_budget_limit"
                type="number"
                min="0"
                step="any"
                value={newCampaign.budget_limit}
                onChange={(e) => set({ budget_limit: e.target.value })}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  )
}
