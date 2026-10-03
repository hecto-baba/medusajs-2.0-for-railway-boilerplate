"use client"

import {
  batchVendorPromotionRules,
  createVendorCampaign,
  createVendorPromotion,
  deleteVendorCampaign,
  listVendorCustomerGroups,
  updateVendorPromotion,
  type VendorPromotion,
  type VendorPromotionRule,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Checkbox,
  Heading,
  IconButton,
  Input,
  Label,
  ProgressTabs,
  RadioGroup,
  Select,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { Plus, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { PromotionProductRules } from "./promotion-product-rules"
import {
  CampaignChoice,
  DEFAULT_NEW_CAMPAIGN,
  NewCampaignDraft,
  PromotionCampaignStep,
} from "./promotion-campaign-step"
import {
  getTemplate,
  PROMOTION_TEMPLATES,
  templateFromPromotion,
  type PromotionTemplateId,
} from "./templates"

type PromotionFormProps = {
  promotion?: VendorPromotion
}

const Card = ({
  title,
  description,
  children,
}: {
  title?: string
  description?: string
  children: React.ReactNode
}) => (
  <div className="bg-ui-bg-base shadow-elevation-card-rest flex flex-col gap-y-4 rounded-lg p-6">
    {title ? (
      <div className="flex flex-col gap-y-1">
        <Heading level="h2">{title}</Heading>
        {description ? (
          <Text size="small" className="text-ui-fg-subtle">
            {description}
          </Text>
        ) : null}
      </div>
    ) : null}
    {children}
  </div>
)

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

const productIdsFromRules = (rules?: VendorPromotionRule[]): string[] =>
  (rules ?? [])
    .filter((rule) => rule.attribute === "product")
    .flatMap((rule) => rule.values)

type Tab = "type" | "details" | "campaign"
const TAB_ORDER: Tab[] = ["type", "details", "campaign"]

/**
 * Create and edit share one form. Structured as a 3-step wizard - Type,
 * Details, Campaign - matching the admin's own promotion-create wizard
 * exactly, rather than the earlier single scrolling page.
 *
 * The one deliberate divergence from admin is the Products step folded into
 * Details: target and buy rules stay a fixed "product" picker, because those
 * rules may only name the vendor's own products. "Who can use this code?"
 * is separate and writes a top-level customer_group_id eligibility rule.
 *
 * Editing does not re-run the Type step: application_method.target_type and
 * promotion.type cannot change after creation (the backend's UpdatePromotion
 * validator does not accept them), so edit opens straight on Details.
 */
export const PromotionForm = ({ promotion }: PromotionFormProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isEdit = Boolean(promotion)

  const method = promotion?.application_method

  const [tab, setTab] = useState<Tab>(isEdit ? "details" : "type")
  const [templateId, setTemplateId] = useState<PromotionTemplateId>(() =>
    promotion
      ? templateFromPromotion(
          promotion.type,
          method?.target_type ?? "items",
          method?.type ?? "percentage"
        )
      : "amount_off_products"
  )
  const template = getTemplate(templateId)

  const [code, setCode] = useState(promotion?.code ?? "")
  const [status, setStatus] = useState(promotion?.status ?? "draft")
  const [isAutomatic, setIsAutomatic] = useState(promotion?.is_automatic ?? false)
  const [isTaxInclusive, setIsTaxInclusive] = useState(
    promotion?.is_tax_inclusive ?? false
  )

  const [value, setValue] = useState(
    template.id === "free_shipping" || template.id === "buyget"
      ? "100"
      : method?.value?.toString() ?? ""
  )
  const [currencyCode, setCurrencyCode] = useState(method?.currency_code ?? "eur")
  const [allocation, setAllocation] = useState<"each" | "across" | "once">(
    method?.allocation ?? (template.usesTargetProducts ? "each" : "across")
  )
  const [maxQuantity, setMaxQuantity] = useState(
    method?.max_quantity?.toString() ?? ""
  )
  const [limit, setLimit] = useState(promotion?.limit?.toString() ?? "")

  const [targetProductIds, setTargetProductIds] = useState<string[]>(
    productIdsFromRules(method?.target_rules)
  )
  // The single "product" rule's id, if the promotion already has one - needed
  // to send an update rather than a create on the batch rules endpoint (see
  // saveRules below). Undefined until the rule exists.
  const [targetRuleId, setTargetRuleId] = useState<string | undefined>(
    method?.target_rules?.find((rule) => rule.attribute === "product")?.id
  )
  const [buyProductIds, setBuyProductIds] = useState<string[]>(
    productIdsFromRules(method?.buy_rules)
  )
  const [buyRuleId, setBuyRuleId] = useState<string | undefined>(
    method?.buy_rules?.find((rule) => rule.attribute === "product")?.id
  )
  const [buyMinQuantity, setBuyMinQuantity] = useState(
    method?.buy_rules_min_quantity?.toString() ?? "1"
  )
  const [applyToQuantity, setApplyToQuantity] = useState(
    method?.apply_to_quantity?.toString() ?? "1"
  )

  type EligibilityCondition = {
    id: string
    attribute: "customer_group_id" | "customer_id" | "customer_email" | "currency_code"
    operator: "in" | "eq" | "not_in"
    value: string
  }

  const initialCustomerGroupRule = promotion?.rules?.find(
    (r) => r.attribute === "customer_group_id" || r.attribute === "customer_group"
  )
  const [eligibilityType, setEligibilityType] = useState<"all" | "groups">(
    initialCustomerGroupRule && initialCustomerGroupRule.values?.length ? "groups" : "all"
  )
  const [selectedCustomerGroupIds, setSelectedCustomerGroupIds] = useState<string[]>(
    initialCustomerGroupRule
      ? Array.isArray(initialCustomerGroupRule.values)
        ? (initialCustomerGroupRule.values as string[])
        : [initialCustomerGroupRule.values as string]
      : []
  )
  const [conditions, setConditions] = useState<EligibilityCondition[]>(() => {
    if (initialCustomerGroupRule && initialCustomerGroupRule.values?.length) {
      const vals = Array.isArray(initialCustomerGroupRule.values)
        ? (initialCustomerGroupRule.values as string[])
        : [initialCustomerGroupRule.values as string]
      return [
        {
          id: "initial_1",
          attribute: "customer_group_id",
          operator: (initialCustomerGroupRule.operator as any) || "in",
          value: vals[0] || "",
        },
      ]
    }
    return [
      {
        id: "default_1",
        attribute: "customer_group_id",
        operator: "in",
        value: "",
      },
    ]
  })
  const [customerGroupRuleId] = useState<string | undefined>(
    initialCustomerGroupRule?.id
  )

  const { data: customerGroupsData, isLoading: isLoadingCustomerGroups } = useQuery({
    queryKey: ["vendor-customer-groups-picker"],
    queryFn: () => listVendorCustomerGroups({ limit: 100, offset: 0 }),
  })
  const customerGroups = customerGroupsData?.customer_groups ?? []

  const [campaignChoice, setCampaignChoice] = useState<CampaignChoice>("none")
  const [existingCampaignId, setExistingCampaignId] = useState<string | null>(null)
  const [newCampaign, setNewCampaign] = useState<NewCampaignDraft>(
    DEFAULT_NEW_CAMPAIGN
  )

  const [error, setError] = useState<string | null>(null)

  /**
   * Applies a template's own defaults on top of a clean slate, mirroring the
   * admin's full form.reset() + defaultValues on template change - not doing
   * this left stale value/allocation/currency/product selections from the
   * previous template in place, which could silently submit a promotion that
   * looked like the new template but carried old numbers.
   */
  const applyTemplate = (next: PromotionTemplateId) => {
    const nextTemplate = getTemplate(next)
    setTemplateId(next)
    setValue(
      nextTemplate.id === "free_shipping" || nextTemplate.id === "buyget"
        ? "100"
        : ""
    )
    setCurrencyCode("eur")
    setAllocation(nextTemplate.usesTargetProducts ? "each" : "across")
    setMaxQuantity("")
    setTargetProductIds([])
    setTargetRuleId(undefined)
    setBuyProductIds([])
    setBuyRuleId(undefined)
    setBuyMinQuantity("1")
    setApplyToQuantity("1")
    setEligibilityType("all")
    setSelectedCustomerGroupIds([])
    setConditions([
      {
        id: "default_1",
        attribute: "customer_group_id",
        operator: "in",
        value: "",
      },
    ])
  }

  const isFreeShipping = template.id === "free_shipping"

  // A spend-type campaign budget is only meaningful in the same currency as
  // the promotion it caps; a percentage promotion carries no currency at all.
  const promotionCurrencyCode =
    template.methodType === "fixed" ? currencyCode.trim() || undefined : undefined

  const buildRules = (ids: string[]) =>
    ids.length
      ? [{ attribute: "product" as const, operator: "in" as const, values: ids }]
      : undefined

  /**
   * Applies target_rules/buy_rules/rules changes through the dedicated batch
   * endpoints rather than through application_method on the update call:
   * AdminUpdateApplicationMethod is .strict() and does not accept
   * target_rules/buy_rules at all, so sending them there is rejected outright
   * rather than merely ignored.
   */
  const saveRules = async (promotionId: string) => {
    const targetIds = template.usesTargetProducts ? targetProductIds : []
    const buyIds = template.usesBuyProducts ? buyProductIds : []
    const groupIds = eligibilityType === "groups" ? selectedCustomerGroupIds : []

    const targetBody = targetRuleId
      ? targetIds.length
        ? { update: [{ id: targetRuleId, values: targetIds }] }
        : { delete: [targetRuleId] }
      : targetIds.length
        ? {
            create: [
              { attribute: "product" as const, operator: "in" as const, values: targetIds },
            ],
          }
        : null

    const buyBody = buyRuleId
      ? buyIds.length
        ? { update: [{ id: buyRuleId, values: buyIds }] }
        : { delete: [buyRuleId] }
      : buyIds.length
        ? {
            create: [
              { attribute: "product" as const, operator: "in" as const, values: buyIds },
            ],
          }
        : null

    const rulesBody = customerGroupRuleId
      ? groupIds.length
        ? { update: [{ id: customerGroupRuleId, values: groupIds }] }
        : { delete: [customerGroupRuleId] }
      : groupIds.length
        ? {
            create: [
              { attribute: "customer_group_id", operator: "in" as const, values: groupIds },
            ],
          }
        : null

    if (rulesBody) {
      await batchVendorPromotionRules(promotionId, "rules", rulesBody)
    }

    if (targetBody) {
      await batchVendorPromotionRules(promotionId, "target-rules", targetBody)
    }

    if (buyBody) {
      await batchVendorPromotionRules(promotionId, "buy-rules", buyBody)
    }
  }

  /** Creates the campaign first (writing the vendor link) so the promotion can reference it by id - see helpers.ts's assertNoInlineCampaign for why this can't be one call. */
  const resolveCampaignId = async (): Promise<string | undefined> => {
    if (campaignChoice === "existing") {
      return existingCampaignId ?? undefined
    }

    if (campaignChoice === "new" && newCampaign.name.trim()) {
      const { campaign } = await createVendorCampaign({
        name: newCampaign.name.trim(),
        campaign_identifier: newCampaign.campaign_identifier.trim(),
        description: newCampaign.description.trim() || undefined,
        starts_at: newCampaign.starts_at || undefined,
        ends_at: newCampaign.ends_at || undefined,
        budget: {
          type: newCampaign.budget_type,
          limit: newCampaign.budget_limit.trim()
            ? Number(newCampaign.budget_limit)
            : undefined,
          currency_code:
            newCampaign.budget_type === "spend"
              ? promotionCurrencyCode ||
                newCampaign.budget_currency_code.trim() ||
                undefined
              : undefined,
          attribute:
            newCampaign.budget_type === "usage"
              ? newCampaign.budget_attribute || undefined
              : undefined,
        },
      })

      return campaign.id
    }

    return undefined
  }

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        // target_rules/buy_rules are deliberately left off this payload -
        // AdminUpdateApplicationMethod is .strict() and rejects them outright.
        // They're applied afterwards through saveRules, which calls the
        // dedicated batch-rules endpoints instead.
        const application_method: Record<string, unknown> = {
          value: Number(value),
          type: template.methodType,
          target_type: template.targetType,
          allocation,
          currency_code: template.methodType === "fixed" ? currencyCode : undefined,
          max_quantity: maxQuantity.trim() ? Number(maxQuantity) : undefined,
        }

        if (template.promotionType === "buyget") {
          application_method.buy_rules_min_quantity = Number(buyMinQuantity)
          application_method.apply_to_quantity = Number(applyToQuantity)
        }

        const result = await updateVendorPromotion(promotion!.id, {
          code: code.trim(),
          status,
          is_automatic: isAutomatic,
          is_tax_inclusive: isTaxInclusive,
          application_method,
          limit: limit.trim() ? Number(limit) : null,
        })

        await saveRules(promotion!.id)

        return result
      }

      const application_method: Record<string, unknown> = {
        value: Number(value),
        type: template.methodType,
        target_type: template.targetType,
        allocation,
        currency_code: template.methodType === "fixed" ? currencyCode : undefined,
        max_quantity: maxQuantity.trim() ? Number(maxQuantity) : undefined,
        target_rules: template.usesTargetProducts
          ? buildRules(targetProductIds)
          : undefined,
      }

      if (template.promotionType === "buyget") {
        application_method.buy_rules = buildRules(buyProductIds)
        application_method.buy_rules_min_quantity = Number(buyMinQuantity)
        application_method.apply_to_quantity = Number(applyToQuantity)
      }

      const campaign_id = await resolveCampaignId()
      const eligibilityRules =
        eligibilityType === "groups" && selectedCustomerGroupIds.length
          ? [
              {
                attribute: "customer_group_id",
                operator: "in" as const,
                values: selectedCustomerGroupIds,
              },
            ]
          : undefined

      try {
        return await createVendorPromotion({
          code: code.trim(),
          status,
          type: template.promotionType,
          is_automatic: isAutomatic,
          is_tax_inclusive: isTaxInclusive,
          application_method,
          rules: eligibilityRules,
          limit: limit.trim() ? Number(limit) : undefined,
          campaign_id,
        })
      } catch (cause) {
        // A campaign created just above for this promotion would otherwise be
        // left behind with nothing attached to it - only campaigns created
        // fresh in this same submission are ever rolled back; an existing
        // campaign the vendor picked is never touched.
        if (campaign_id && campaignChoice === "new") {
          await deleteVendorCampaign(campaign_id).catch(() => undefined)
        }

        throw cause
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-promotions"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-campaigns-picker"] })

      if (isEdit) {
        queryClient.invalidateQueries({
          queryKey: ["vendor-promotion", promotion!.id],
        })
      }
    },
  })

  const validateDetails = (): string | null => {
    if (!code.trim()) {
      return "A code is required."
    }

    if (!value.trim() || Number.isNaN(Number(value)) || Number(value) < 0) {
      return "Enter a value of zero or more."
    }

    if (template.usesTargetProducts && !targetProductIds.length) {
      return "Select at least one of your products to discount."
    }

    if (template.usesBuyProducts && !buyProductIds.length) {
      return "Select at least one product the customer must buy."
    }

    if (
      template.usesTargetProducts &&
      (allocation === "each" || allocation === "once") &&
      !maxQuantity.trim()
    ) {
      return "Maximum quantity is required for Each and Once allocation."
    }

    if (limit.trim() && (Number.isNaN(Number(limit)) || Number(limit) < 1)) {
      return "Usage limit must be at least 1, or left blank for no limit."
    }

    if (isAutomatic && limit.trim()) {
      return "Automatic promotions cannot have a usage limit."
    }

    if (eligibilityType === "groups" && !selectedCustomerGroupIds.length) {
      return "Select at least one customer group, or allow all customers."
    }

    return null
  }

  const goToNextTab = () => {
    if (tab === "details") {
      const validationError = validateDetails()

      if (validationError) {
        setError(validationError)
        return
      }
    }

    setError(null)
    const index = TAB_ORDER.indexOf(tab)
    setTab(TAB_ORDER[Math.min(index + 1, TAB_ORDER.length - 1)])
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const validationError = validateDetails()

    if (validationError) {
      setError(validationError)
      setTab("details")
      return
    }

    try {
      await save()
      toast.success(isEdit ? "Promotion updated." : "Promotion created.")
      router.push(isEdit ? `/promotions/${promotion!.id}` : "/promotions")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save the promotion."
      )
    }
  }

  const isLastTab = tab === "campaign"

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-y-6">
      <ProgressTabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="bg-ui-bg-base shadow-elevation-card-rest flex items-center justify-between rounded-lg px-6 py-4">
          <ProgressTabs.List>
            <ProgressTabs.Trigger
              value="type"
              status={
                isEdit
                  ? "completed"
                  : tab === "type"
                    ? "in-progress"
                    : "completed"
              }
              disabled={isEdit}
            >
              Type
            </ProgressTabs.Trigger>
            <ProgressTabs.Trigger
              value="details"
              status={
                tab === "details"
                  ? "in-progress"
                  : tab === "campaign"
                    ? "completed"
                    : "not-started"
              }
            >
              Details
            </ProgressTabs.Trigger>
            <ProgressTabs.Trigger
              value="campaign"
              status={tab === "campaign" ? "in-progress" : "not-started"}
              disabled={isEdit}
            >
              Campaign
            </ProgressTabs.Trigger>
          </ProgressTabs.List>

          <div className="flex items-center gap-x-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() =>
                router.push(isEdit ? `/promotions/${promotion!.id}` : "/promotions")
              }
            >
              Cancel
            </Button>
            {isEdit || isLastTab ? (
              <Button type="submit" isLoading={isPending}>
                Save
              </Button>
            ) : (
              <Button type="button" onClick={goToNextTab}>
                Continue
              </Button>
            )}
          </div>
        </div>

        <ProgressTabs.Content value="type" className="mt-6">
          <Card>
            <RadioGroup
              value={templateId}
              onValueChange={(v) => applyTemplate(v as PromotionTemplateId)}
            >
              {PROMOTION_TEMPLATES.map((option) => (
                <RadioGroup.ChoiceBox
                  key={option.id}
                  value={option.id}
                  label={option.title}
                  description={option.description}
                />
              ))}
            </RadioGroup>
          </Card>
        </ProgressTabs.Content>

        <ProgressTabs.Content value="details" className="mt-6">
          <div className="flex flex-col gap-y-6">
            <Card title="Promotion details" description={template.title}>
              <Field
                id="code"
                label="Code"
                hint="What the customer enters at checkout."
              >
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="SUMMER10"
                />
              </Field>

              <Field label="Status">
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as typeof status)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="draft">Draft</Select.Item>
                    <Select.Item value="active">Active</Select.Item>
                    <Select.Item value="inactive">Inactive</Select.Item>
                  </Select.Content>
                </Select>
              </Field>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <Label size="small" weight="plus">
                    Automatic
                  </Label>
                  <Text size="small" className="text-ui-fg-subtle">
                    Applied automatically at checkout, without the customer
                    entering a code.
                  </Text>
                </div>
                <Switch
                  checked={isAutomatic}
                  onCheckedChange={(checked) => {
                    setIsAutomatic(checked)

                    if (checked) {
                      setLimit("")
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <Label size="small" weight="plus">
                    Include taxes
                  </Label>
                  <Text size="small" className="text-ui-fg-subtle">
                    Apply the promotion after taxes.
                  </Text>
                </div>
                <Switch
                  checked={isTaxInclusive}
                  onCheckedChange={setIsTaxInclusive}
                />
              </div>
            </Card>

            <Card
              title="Discount"
              description="How much the discount is worth, and how it is applied."
            >
              {!isFreeShipping && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    id="value"
                    label={
                      template.methodType === "percentage"
                        ? "Percentage off"
                        : "Amount off"
                    }
                  >
                    <Input
                      id="value"
                      type="number"
                      min="0"
                      step="any"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={
                        template.methodType === "percentage" ? "10" : "5.00"
                      }
                    />
                  </Field>

                  {template.methodType === "fixed" && (
                    <Field id="currency_code" label="Currency">
                      <Input
                        id="currency_code"
                        value={currencyCode ?? ""}
                        onChange={(e) =>
                          setCurrencyCode(e.target.value.toLowerCase())
                        }
                        placeholder="eur"
                      />
                    </Field>
                  )}
                </div>
              )}

              {template.usesTargetProducts && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Allocation"
                    hint="Each enforces the quantity limit per item, Across splits the discount over every matching item, and Once enforces the quantity limit across the entire cart."
                  >
                    <Select
                      value={allocation}
                      onValueChange={(v) => {
                        const next = v as typeof allocation
                        setAllocation(next)

                        if (next === "across") {
                          setMaxQuantity("")
                        }
                      }}
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="each">Each</Select.Item>
                        <Select.Item value="across">Across</Select.Item>
                        <Select.Item value="once">Once</Select.Item>
                      </Select.Content>
                    </Select>
                  </Field>

                  <Field
                    id="max_quantity"
                    label="Maximum quantity"
                    hint={
                      allocation === "across"
                        ? "Not used with Across allocation."
                        : "The maximum quantity of items this promotion applies to."
                    }
                  >
                    <Input
                      id="max_quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={maxQuantity}
                      onChange={(e) => setMaxQuantity(e.target.value)}
                      disabled={allocation === "across"}
                    />
                  </Field>
                </div>
              )}

              <Field
                id="limit"
                label="Usage limit"
                hint={
                  isAutomatic
                    ? "Automatic promotions cannot have a usage limit."
                    : "The maximum number of times this promotion can be used in total. Leave blank for no limit."
                }
              >
                <Input
                  id="limit"
                  type="number"
                  min="1"
                  step="1"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  disabled={isAutomatic}
                />
              </Field>
            </Card>

            <Card
              title="Who can use this code?"
              description="Leave it open to everyone, or limit redemption to customer groups you own."
            >
              <RadioGroup
                value={eligibilityType}
                onValueChange={(value) => {
                  const next = value as "all" | "groups"
                  setEligibilityType(next)
                  if (next === "all") {
                    setSelectedCustomerGroupIds([])
                  }
                }}
              >
                <RadioGroup.ChoiceBox
                  value="all"
                  label="All customers"
                  description="Anyone can redeem this code."
                />
                <RadioGroup.ChoiceBox
                  value="groups"
                  label="Specific customer groups"
                  description="Only customers in the selected groups can redeem this code."
                />
              </RadioGroup>

              {eligibilityType === "groups" && (
                <div className="flex flex-col gap-y-4 pt-2">
                  <div className="flex flex-col gap-y-3">
                    {conditions.map((cond, index) => (
                      <div key={cond.id} className="flex flex-col gap-y-2">
                        {index > 0 && (
                          <div className="flex items-center gap-x-2 py-1">
                            <Badge size="2xsmall" color="grey" className="font-semibold uppercase tracking-wider">
                              AND
                            </Badge>
                            <div className="h-px flex-1 bg-ui-border-base" />
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 sm:flex-nowrap">
                          {/* Attribute */}
                          <div className="flex min-w-[150px] flex-1 flex-col gap-y-1">
                            <span className="text-[11px] font-medium text-ui-fg-muted uppercase tracking-wider">Attribute</span>
                            <Select
                              value={cond.attribute}
                              onValueChange={(val) => {
                                setConditions((prev) =>
                                  prev.map((c) =>
                                    c.id === cond.id
                                      ? {
                                          ...c,
                                          attribute: val as EligibilityCondition["attribute"],
                                          value: val === "customer_group_id" && customerGroups[0] ? customerGroups[0].id : "",
                                        }
                                      : c
                                  )
                                )
                                if (val === "customer_group_id" && customerGroups[0]) {
                                  setSelectedCustomerGroupIds((curr) =>
                                    curr.includes(customerGroups[0].id) ? curr : [...curr, customerGroups[0].id]
                                  )
                                }
                              }}
                            >
                              <Select.Trigger className="bg-ui-bg-base">
                                <Select.Value />
                              </Select.Trigger>
                              <Select.Content>
                                <Select.Item value="customer_group_id">Customer Group</Select.Item>
                                <Select.Item value="customer_id">Customer ID</Select.Item>
                                <Select.Item value="customer_email">Customer Email</Select.Item>
                                <Select.Item value="currency_code">Currency Code</Select.Item>
                              </Select.Content>
                            </Select>
                          </div>

                          {/* Operator */}
                          <div className="flex min-w-[120px] flex-1 flex-col gap-y-1">
                            <span className="text-[11px] font-medium text-ui-fg-muted uppercase tracking-wider">Operator</span>
                            <Select
                              value={cond.operator}
                              onValueChange={(val) => {
                                setConditions((prev) =>
                                  prev.map((c) =>
                                    c.id === cond.id
                                      ? { ...c, operator: val as EligibilityCondition["operator"] }
                                      : c
                                  )
                                )
                              }}
                            >
                              <Select.Trigger className="bg-ui-bg-base">
                                <Select.Value />
                              </Select.Trigger>
                              <Select.Content>
                                <Select.Item value="in">In</Select.Item>
                                <Select.Item value="eq">Equals</Select.Item>
                                <Select.Item value="not_in">Not In</Select.Item>
                              </Select.Content>
                            </Select>
                          </div>

                          {/* Value */}
                          <div className="flex min-w-[200px] flex-[2] flex-col gap-y-1">
                            <span className="text-[11px] font-medium text-ui-fg-muted uppercase tracking-wider">Value</span>
                            {cond.attribute === "customer_group_id" ? (
                              customerGroups.length > 0 ? (
                                <Select
                                  value={cond.value || (customerGroups[0]?.id ?? "")}
                                  onValueChange={(val) => {
                                    setConditions((prev) =>
                                      prev.map((c) =>
                                        c.id === cond.id ? { ...c, value: val } : c
                                      )
                                    )
                                    setSelectedCustomerGroupIds((curr) =>
                                      curr.includes(val) ? curr : [...curr, val]
                                    )
                                  }}
                                >
                                  <Select.Trigger className="bg-ui-bg-base">
                                    <Select.Value />
                                  </Select.Trigger>
                                  <Select.Content>
                                    {customerGroups.map((g) => (
                                      <Select.Item key={g.id} value={g.id}>
                                        {g.name}
                                      </Select.Item>
                                    ))}
                                  </Select.Content>
                                </Select>
                              ) : (
                                <Input
                                  disabled
                                  placeholder="No customer groups found"
                                  className="bg-ui-bg-base"
                                />
                              )
                            ) : (
                              <Input
                                placeholder={
                                  cond.attribute === "customer_email"
                                    ? "e.g. user@example.com"
                                    : cond.attribute === "currency_code"
                                    ? "e.g. usd"
                                    : "e.g. cus_..."
                                }
                                value={cond.value}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setConditions((prev) =>
                                    prev.map((c) =>
                                      c.id === cond.id ? { ...c, value: val } : c
                                    )
                                  )
                                }}
                                className="bg-ui-bg-base"
                              />
                            )}
                          </div>

                          {/* Delete condition */}
                          {conditions.length > 1 && (
                            <div className="flex self-end pb-0.5">
                              <IconButton
                                type="button"
                                variant="transparent"
                                size="small"
                                onClick={() => {
                                  setConditions((prev) => prev.filter((c) => c.id !== cond.id))
                                }}
                              >
                                <Trash className="text-ui-fg-subtle" />
                              </IconButton>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-ui-border-base pt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="small"
                      onClick={() => {
                        setConditions((prev) => [
                          ...prev,
                          {
                            id: `condition_${Date.now()}`,
                            attribute: "customer_group_id",
                            operator: "in",
                            value: customerGroups[0]?.id ?? "",
                          },
                        ])
                      }}
                    >
                      <Plus className="mr-1" />
                      Add condition
                    </Button>
                  </div>

                  {/* Customer Groups Quick Picker */}
                  <div className="mt-2 flex flex-col gap-y-2 border-t border-ui-border-base pt-3">
                    <Label size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
                      Select Customer Groups
                    </Label>
                    {isLoadingCustomerGroups ? (
                      <Text size="small" className="text-ui-fg-subtle">
                        Loading customer groups…
                      </Text>
                    ) : customerGroups.length === 0 ? (
                      <Text size="small" className="text-ui-fg-subtle">
                        You don&apos;t have any customer groups yet. Create one under Customers, or allow all customers.
                      </Text>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {customerGroups.map((group) => {
                          const checked = selectedCustomerGroupIds.includes(group.id)
                          return (
                            <label
                              key={group.id}
                              className="flex cursor-pointer items-center gap-x-3 rounded-md border border-ui-border-base bg-ui-bg-subtle px-3 py-2"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  setSelectedCustomerGroupIds((current) =>
                                    value
                                      ? current.includes(group.id)
                                        ? current
                                        : [...current, group.id]
                                      : current.filter((id) => id !== group.id)
                                  )
                                }}
                              />
                              <span className="txt-compact-small text-ui-fg-base">
                                {group.name}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {(template.usesTargetProducts || template.usesBuyProducts) && (
              <Card
                title="Products"
                description="Only your own products can be selected - the discount cannot touch another seller's catalogue."
              >
                {template.usesTargetProducts && (
                  <PromotionProductRules
                    label="Discounted products"
                    hint="The discount applies to these products."
                    selectedIds={targetProductIds}
                    onChange={setTargetProductIds}
                  />
                )}

                {template.usesBuyProducts && (
                  <>
                    <PromotionProductRules
                      label="Products the customer must buy"
                      hint="The customer must buy these to qualify for the discount."
                      selectedIds={buyProductIds}
                      onChange={setBuyProductIds}
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field id="buy_min_quantity" label="Minimum quantity to buy">
                        <Input
                          id="buy_min_quantity"
                          type="number"
                          min="1"
                          step="1"
                          value={buyMinQuantity}
                          onChange={(e) => setBuyMinQuantity(e.target.value)}
                        />
                      </Field>

                      <Field id="apply_to_quantity" label="Quantity discounted">
                        <Input
                          id="apply_to_quantity"
                          type="number"
                          min="1"
                          step="1"
                          value={applyToQuantity}
                          onChange={(e) => setApplyToQuantity(e.target.value)}
                        />
                      </Field>
                    </div>
                  </>
                )}
              </Card>
            )}
          </div>
        </ProgressTabs.Content>

        {!isEdit && (
          <ProgressTabs.Content value="campaign" className="mt-6">
            <Card>
              <PromotionCampaignStep
                choice={campaignChoice}
                onChoiceChange={setCampaignChoice}
                existingCampaignId={existingCampaignId}
                onExistingCampaignChange={setExistingCampaignId}
                newCampaign={newCampaign}
                onNewCampaignChange={setNewCampaign}
                promotionCurrencyCode={promotionCurrencyCode}
              />
            </Card>
          </ProgressTabs.Content>
        )}
      </ProgressTabs>

      {error && (
        <Text size="small" className="text-ui-fg-error">
          {error}
        </Text>
      )}
    </form>
  )
}
