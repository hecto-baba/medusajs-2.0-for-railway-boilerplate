"use client"

import {
  deleteVendorCampaign,
  getVendorCampaign,
  type VendorCampaign,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  StatusBadge,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { Calendar, CurrencyDollar, PencilSquare, Tag, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { format } from "date-fns"
import {
  EditCampaignBudgetModal,
  EditCampaignConfigurationModal,
  EditCampaignGeneralModal,
} from "./modals/campaign-edit-modal"

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "—"
  try {
    return format(new Date(dateString), "MMM d, yyyy, h:mm a")
  } catch {
    return "—"
  }
}

export const CampaignDetail = ({ id }: { id: string }) => {
  const router = useRouter()
  const prompt = usePrompt()
  const queryClient = useQueryClient()

  const [editGeneralOpen, setEditGeneralOpen] = useState(false)
  const [editConfigOpen, setEditConfigOpen] = useState(false)
  const [editBudgetOpen, setEditBudgetOpen] = useState(false)

  const { data, isLoading, error } = useQuery<{ campaign: VendorCampaign }>({
    queryKey: ["vendor-campaign", id],
    queryFn: () => getVendorCampaign(id),
  })

  const { mutateAsync: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteVendorCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-campaigns"] })
      toast.success("Campaign deleted.")
      router.push("/promotions/campaigns")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete campaign.")
    },
  })

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: "Delete campaign",
      description: `Are you sure you want to delete "${data?.campaign?.name}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (confirmed) {
      await remove()
    }
  }

  if (isLoading) {
    return (
      <Container className="p-12 text-center">
        <Text size="base" className="text-ui-fg-subtle">
          Loading campaign details...
        </Text>
      </Container>
    )
  }

  if (error || !data?.campaign) {
    return (
      <Container className="p-8 space-y-4">
        <Heading level="h2">Campaign Not Found</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          The requested campaign could not be loaded or you do not have permission to view it.
        </Text>
        <Link href="/promotions/campaigns">
          <Button variant="secondary" size="small">
            ← Back to Campaigns
          </Button>
        </Link>
      </Container>
    )
  }

  const campaign = data.campaign
  const promotions = (campaign as any).promotions || []

  const budget = campaign.budget
  const hasBudget = Boolean(budget)
  const isSpendBudget = budget?.type === "spend"

  return (
    <div className="flex flex-col gap-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/promotions/campaigns"
          className="text-xs text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-1.5 font-semibold transition"
        >
          <span>←</span>
          <span>Back to Campaigns</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="small"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            <Trash className="w-3.5 h-3.5 mr-1" />
            Delete Campaign
          </Button>
        </div>
      </div>

      {/* Main Campaign Header */}
      <Container className="p-6 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <Heading level="h1" className="text-2xl font-bold">
                {campaign.name}
              </Heading>
              <Badge color="blue" size="small" className="font-mono">
                {campaign.campaign_identifier}
              </Badge>
            </div>
            {campaign.description && (
              <Text size="small" className="text-ui-fg-subtle max-w-2xl">
                {campaign.description}
              </Text>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-ui-bg-subtle px-4 py-2 rounded-xl border border-ui-border-base text-center min-w-[100px]">
              <Text size="xsmall" className="text-ui-fg-subtle">
                Promotions
              </Text>
              <Text size="base" weight="plus" className="text-ui-fg-base font-mono">
                {promotions.length}
              </Text>
            </div>
          </div>
        </div>
      </Container>

      {/* Two-Column Layout (Matching Medusa Admin) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Main Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Section */}
          <Container className="p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-base">
              <Heading level="h2" className="text-base font-semibold">
                General
              </Heading>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setEditGeneralOpen(true)}
              >
                <PencilSquare className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Name
                </Text>
                <Text size="small" weight="plus" className="text-ui-fg-base mt-0.5">
                  {campaign.name}
                </Text>
              </div>

              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Campaign Identifier
                </Text>
                <Text size="small" weight="plus" className="text-ui-fg-base font-mono mt-0.5">
                  {campaign.campaign_identifier}
                </Text>
              </div>

              <div className="sm:col-span-2">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Description
                </Text>
                <Text size="small" className="text-ui-fg-base mt-0.5">
                  {campaign.description || "—"}
                </Text>
              </div>
            </div>
          </Container>

          {/* Promotions Section */}
          <Container className="p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-base">
              <div>
                <Heading level="h2" className="text-base font-semibold">
                  Promotions
                </Heading>
                <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                  Promotions grouped under this campaign
                </Text>
              </div>
              <Link href="/promotions/new">
                <Button variant="secondary" size="small">
                  + Add Promotion
                </Button>
              </Link>
            </div>

            {promotions.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Tag className="w-8 h-8 mx-auto text-ui-fg-muted" />
                <Text size="small" weight="plus" className="text-ui-fg-base">
                  No promotions attached yet
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle max-w-sm mx-auto">
                  Attach or create a promotion linked to this campaign to start offering discounts under this budget.
                </Text>
              </div>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Code</Table.HeaderCell>
                    <Table.HeaderCell>Type</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Discount Value</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Action</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {promotions.map((promo: any) => {
                    const method = promo.application_method
                    let discountText = "—"
                    if (method) {
                      discountText =
                        method.type === "percentage"
                          ? `${method.value}%`
                          : `${method.value} ${method.currency_code?.toUpperCase() || ""}`
                    }

                    return (
                      <Table.Row key={promo.id}>
                        <Table.Cell>
                          <Link
                            href={`/promotions/${promo.id}`}
                            className="font-mono font-medium text-ui-fg-interactive hover:underline text-xs"
                          >
                            {promo.code}
                          </Link>
                        </Table.Cell>
                        <Table.Cell className="text-xs">
                          {promo.type === "buyget" ? "Buy X, get Y" : "Standard"}
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge
                            color={
                              promo.status === "active"
                                ? "green"
                                : promo.status === "draft"
                                ? "grey"
                                : "orange"
                            }
                          >
                            {promo.status}
                          </StatusBadge>
                        </Table.Cell>
                        <Table.Cell className="text-xs font-medium">
                          {discountText}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <Link
                            href={`/promotions/${promo.id}`}
                            className="text-xs text-ui-fg-interactive hover:underline"
                          >
                            View →
                          </Link>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table>
            )}
          </Container>
        </div>

        {/* Right / Sidebar Column (1/3 width) */}
        <div className="space-y-6">
          {/* Configuration Section (Schedule) */}
          <Container className="p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-base">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-ui-fg-muted" />
                <Heading level="h2" className="text-base font-semibold">
                  Configuration
                </Heading>
              </div>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setEditConfigOpen(true)}
              >
                <PencilSquare className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Start Date
                </Text>
                <Text size="small" weight="plus" className="text-ui-fg-base mt-0.5">
                  {formatDate(campaign.starts_at)}
                </Text>
              </div>

              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  End Date
                </Text>
                <Text size="small" weight="plus" className="text-ui-fg-base mt-0.5">
                  {formatDate(campaign.ends_at)}
                </Text>
              </div>
            </div>
          </Container>

          {/* Budget Section */}
          <Container className="p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-base">
              <div className="flex items-center gap-2">
                <CurrencyDollar className="w-4 h-4 text-ui-fg-muted" />
                <Heading level="h2" className="text-base font-semibold">
                  Budget
                </Heading>
              </div>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setEditBudgetOpen(true)}
              >
                <PencilSquare className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
            </div>
            <div className="p-6 space-y-4">
              {!budget ? (
                <Text size="small" className="text-ui-fg-subtle">
                  No budget limit configured.
                </Text>
              ) : (
                <>
                  <div>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Budget Type
                    </Text>
                    <Text size="small" weight="plus" className="text-ui-fg-base capitalize mt-0.5">
                      {budget?.type === "spend" ? "Spend Limit" : "Usage Limit"}
                    </Text>
                  </div>

                  <div>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Limit
                    </Text>
                    <Text size="small" weight="plus" className="text-ui-fg-base font-mono mt-0.5">
                      {budget?.limit !== null && budget?.limit !== undefined
                        ? isSpendBudget
                          ? `${budget?.limit} ${budget?.currency_code?.toUpperCase() || ""}`
                          : `${budget?.limit} uses`
                        : "Unlimited"}
                    </Text>
                  </div>

                  {!isSpendBudget && (
                    <div>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Limit usage per
                      </Text>
                      <Text size="small" weight="plus" className="text-ui-fg-base mt-0.5">
                        {budget?.attribute === "customer_id"
                          ? "Per customer"
                          : budget?.attribute === "customer_email"
                            ? "Per email"
                            : "Total uses (across all customers)"}
                      </Text>
                    </div>
                  )}

                  {isSpendBudget && budget?.currency_code && (
                    <div>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Currency
                      </Text>
                      <Text size="small" weight="plus" className="text-ui-fg-base font-mono uppercase mt-0.5">
                        {budget?.currency_code}
                      </Text>
                    </div>
                  )}
                </>
              )}
            </div>
          </Container>
        </div>
      </div>

      {/* Edit Modals */}
      <EditCampaignGeneralModal
        campaign={campaign}
        open={editGeneralOpen}
        onOpenChange={setEditGeneralOpen}
      />

      <EditCampaignConfigurationModal
        campaign={campaign}
        open={editConfigOpen}
        onOpenChange={setEditConfigOpen}
      />

      <EditCampaignBudgetModal
        campaign={campaign}
        open={editBudgetOpen}
        onOpenChange={setEditBudgetOpen}
      />
    </div>
  )
}
