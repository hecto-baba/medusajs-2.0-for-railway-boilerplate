import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  BuildingStorefront,
  CheckCircleSolid,
  Clock,
  DocumentText,
  ExclamationCircle,
  Eye,
  MagnifyingGlass,
  ShieldCheck,
  Sparkles,
  XMark,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Drawer,
  Heading,
  Input,
  Select,
  StatusBadge,
  Text,
  Textarea,
  toast,
  useDataTable,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { sdk } from "../../lib/sdk"
import type { TrustClawSegment } from "../../types/trustclaw"

type AdminApplicationItem = {
  id: string
  vendorId: string
  vendorName?: string
  email?: string
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"
  currentStep: string
  completedSteps: string[]
  segment?: { id: string; name: string; code: string } | null
  vendorType?: { id: string; name: string; code: string } | null
  vendorCategory?: { id: string; name: string; code: string } | null
  rejectionReason?: string | null
  submittedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

type AdminApplicationsResponse = {
  items: AdminApplicationItem[]
  count: number
  limit: number
  offset: number
}

type ApplicationDetailResponse = {
  application: {
    vendorId: string
    status: string
    segment?: { id: string; name: string; code: string } | null
    vendorType?: { id: string; name: string; code: string } | null
    vendorCategory?: { id: string; name: string; code: string } | null
    completedSteps: string[]
    rejectionReason?: string | null
    feedback?: string | null
    submittedAt?: string | null
    answers: Record<string, Record<string, any>>
  }
}

const columnHelper = createDataTableColumnHelper<AdminApplicationItem>()

const PAGE_SIZE = 20

const VendorApplicationsPage = () => {
  const queryClient = useQueryClient()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [segmentFilter, setSegmentFilter] = useState<string>("")
  const [search, setSearch] = useState<string>("")
  const [selectedApp, setSelectedApp] = useState<AdminApplicationItem | null>(null)
  const [rejectReason, setRejectReason] = useState<string>("")
  const [isRejecting, setIsRejecting] = useState<boolean>(false)

  // 1. Fetch Segments for filter
  const { data: segmentsData } = useQuery<{ segments: TrustClawSegment[] }>({
    queryKey: ["admin-taxonomy-segments"],
    queryFn: () =>
      sdk.client.fetch<{ segments: TrustClawSegment[] }>(
        "/admin/taxonomy/segments"
      ),
    staleTime: 10 * 60 * 1000,
  })
  const segments = segmentsData?.segments ?? []

  // 2. Fetch Applications
  const { data, isLoading, refetch } = useQuery<AdminApplicationsResponse>({
    queryKey: [
      "admin-vendor-applications",
      statusFilter,
      segmentFilter,
      search,
      pagination.pageIndex,
      pagination.pageSize,
    ],
    queryFn: () =>
      sdk.client.fetch<AdminApplicationsResponse>(
        "/admin/vendors/applications",
        {
          query: {
            limit: pagination.pageSize,
            offset: pagination.pageIndex * pagination.pageSize,
            ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
            ...(segmentFilter ? { segmentId: segmentFilter } : {}),
            ...(search.trim() ? { search: search.trim() } : {}),
          },
        }
      ),
  })

  // 3. Fetch Selected Application Detail
  const { data: detailData, isLoading: isLoadingDetail } =
    useQuery<ApplicationDetailResponse>({
      queryKey: ["admin-application-detail", selectedApp?.vendorId],
      queryFn: () =>
        sdk.client.fetch<ApplicationDetailResponse>(
          `/admin/vendors/applications/${selectedApp?.vendorId}`
        ),
      enabled: !!selectedApp?.vendorId,
    })

  // 4. Approve Mutation
  const approveMutation = useMutation({
    mutationFn: (vendorId: string) =>
      sdk.client.fetch(
        `/admin/vendors/applications/${vendorId}/approve`,
        { method: "POST" }
      ),
    onSuccess: () => {
      toast.success("Vendor application approved successfully!")
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-applications"] })
      setSelectedApp(null)
    },
    onError: () => {
      toast.error("Failed to approve application.")
    },
  })

  // 5. Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: ({
      vendorId,
      reason,
    }: {
      vendorId: string
      reason: string
    }) =>
      sdk.client.fetch(
        `/admin/vendors/applications/${vendorId}/reject`,
        {
          method: "POST",
          body: { reason },
        }
      ),
    onSuccess: () => {
      toast.success("Application rejected and feedback sent to vendor.")
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-applications"] })
      setSelectedApp(null)
      setIsRejecting(false)
      setRejectReason("")
    },
    onError: () => {
      toast.error("Failed to reject application.")
    },
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor("vendorName", {
        header: "Store Name",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold text-ui-fg-base text-xs">
              {row.original.vendorName || "Unnamed Store"}
            </span>
            <span className="text-[11px] text-ui-fg-muted font-mono truncate max-w-[160px]">
              {row.original.vendorId}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("email", {
        header: "Contact Email",
        cell: ({ getValue }) => (
          <span className="text-xs text-ui-fg-subtle">{getValue() || "—"}</span>
        ),
      }),
      columnHelper.accessor("segment", {
        header: "Vertical",
        cell: ({ row }) => {
          const seg = row.original.segment
          return seg ? (
            <Badge size="xsmall" color="blue">
              {seg.name}
            </Badge>
          ) : (
            <span className="text-ui-fg-muted text-xs">—</span>
          )
        },
      }),
      columnHelper.accessor("vendorType", {
        header: "Model",
        cell: ({ row }) => {
          const vt = row.original.vendorType
          return vt ? (
            <Badge size="xsmall" color="purple">
              {vt.code}
            </Badge>
          ) : (
            <span className="text-ui-fg-muted text-xs">—</span>
          )
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue()
          if (s === "APPROVED") {
            return <StatusBadge color="green">Approved</StatusBadge>
          }
          if (s === "REJECTED") {
            return <StatusBadge color="red">Changes Req</StatusBadge>
          }
          if (s === "SUBMITTED" || s === "UNDER_REVIEW") {
            return <StatusBadge color="blue">Under Review</StatusBadge>
          }
          return <StatusBadge color="grey">Draft</StatusBadge>
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="small"
              onClick={() => setSelectedApp(row.original)}
              className="flex items-center gap-x-1 text-xs"
            >
              <Eye className="h-3.5 w-3.5" /> Review
            </Button>
          </div>
        ),
      }),
    ],
    []
  )

  const rawData = data?.items ?? []
  const count = data?.count ?? 0
  const table = useDataTable({
    data: rawData,
    columns,
    rowCount: count,
    getRowId: (row) => row.id || row.vendorId,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  const appDetail = detailData?.application
  const allAnswers = appDetail?.answers || {}

  return (
    <Container className="p-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-y-3 p-6 border-b border-ui-border-base bg-ui-bg-subtle/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ui-bg-interactive text-ui-fg-on-color">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <Heading level="h1" className="text-xl font-bold text-ui-fg-base">
                Vendor Onboarding Applications
              </Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Review, audit, and approve new merchant registrations and category assignments.
              </Text>
            </div>
          </div>
          <Button
            variant="secondary"
            size="small"
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Status Segment Filter Pills */}
          <div className="flex items-center gap-1 bg-ui-bg-subtle p-1 rounded-lg border border-ui-border-base text-xs">
            {["ALL", "UNDER_REVIEW", "APPROVED", "REJECTED", "DRAFT"].map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${statusFilter === st
                      ? "bg-ui-bg-base text-ui-fg-base shadow-elevation-card-rest"
                      : "text-ui-fg-subtle hover:text-ui-fg-base"
                    }`}
                >
                  {st.replace("_", " ")}
                </button>
              )
            )}
          </div>

          {/* Segment Filter */}
          <div className="w-48">
            <Select
              size="small"
              value={segmentFilter || undefined}
              onValueChange={(val) =>
                setSegmentFilter(val === "__ALL__" ? "" : val)
              }
            >
              <Select.Trigger>
                <Select.Value placeholder="All Verticals" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="__ALL__">All Verticals</Select.Item>
                {segments.map((s) => (
                  <Select.Item key={s.id} value={s.id}>
                    {s.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {/* Search */}
          <div className="w-56 ml-auto">
            <Input
              size="small"
              placeholder="Search stores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Applications Data Table */}
      <DataTable instance={table}>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>

      {/* Application Detail Drawer */}
      {selectedApp && (
        <Drawer
          open={!!selectedApp}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedApp(null)
              setIsRejecting(false)
            }
          }}
        >
          <Drawer.Content className="max-w-2xl bg-ui-bg-base p-6 flex flex-col gap-y-6 overflow-y-auto max-h-screen">
            <Drawer.Header className="border-b border-ui-border-base pb-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <Drawer.Title className="text-lg font-bold text-ui-fg-base">
                    {selectedApp.vendorName || "Vendor Application"}
                  </Drawer.Title>
                  <Drawer.Description className="text-xs text-ui-fg-subtle">
                    Vendor ID: {selectedApp.vendorId}
                  </Drawer.Description>
                </div>
                <Badge
                  color={
                    selectedApp.status === "APPROVED"
                      ? "green"
                      : selectedApp.status === "REJECTED"
                        ? "red"
                        : "blue"
                  }
                >
                  {selectedApp.status}
                </Badge>
              </div>
            </Drawer.Header>

            {isLoadingDetail ? (
              <div className="flex flex-col items-center justify-center py-12 gap-y-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-ui-border-interactive border-t-transparent" />
                <Text size="small" className="text-ui-fg-subtle">
                  Loading verification details...
                </Text>
              </div>
            ) : (
              <div className="flex flex-col gap-y-6">
                {/* Vertical & Classification */}
                <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle/40 flex flex-col gap-y-2 text-xs">
                  <span className="font-semibold text-ui-fg-base uppercase tracking-wider text-[10px]">
                    Vertical & Store Model
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-ui-fg-muted block">Vertical:</span>
                      <span className="font-semibold text-ui-fg-base">
                        {appDetail?.segment?.name || selectedApp.segment?.name || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-ui-fg-muted block">Model:</span>
                      <span className="font-semibold text-ui-fg-base">
                        {appDetail?.vendorType?.code || selectedApp.vendorType?.code || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-ui-fg-muted block">Category:</span>
                      <span className="font-semibold text-ui-fg-base">
                        {appDetail?.vendorCategory?.name || selectedApp.vendorCategory?.name || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submitted Steps Details */}
                {Object.entries(allAnswers).map(([stepKey, stepAnswers]) => {
                  if (!stepAnswers || typeof stepAnswers !== "object") return null
                  return (
                    <div
                      key={stepKey}
                      className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-base flex flex-col gap-y-2 text-xs"
                    >
                      <span className="font-semibold text-ui-fg-base uppercase tracking-wider text-[10px] text-ui-fg-interactive">
                        {stepKey}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {Object.entries(stepAnswers).map(([fieldKey, val]) => (
                          <div key={fieldKey} className="flex flex-col">
                            <span className="text-ui-fg-muted text-[11px] capitalize">
                              {fieldKey.replace(/_/g, " ")}:
                            </span>
                            <span className="font-medium text-ui-fg-base truncate">
                              {typeof val === "object" ? JSON.stringify(val) : String(val || "—")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Rejection Input Box */}
                {isRejecting && (
                  <div className="p-4 rounded-lg border border-ui-border-error/50 bg-ui-bg-error/5 flex flex-col gap-y-3">
                    <span className="text-xs font-semibold text-ui-fg-error">
                      Reason for Rejection / Revision Request:
                    </span>
                    <Textarea
                      placeholder="Specify what documents or fields the merchant needs to update..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                    />
                    <div className="flex items-center justify-end gap-x-2">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setIsRejecting(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        size="small"
                        disabled={!rejectReason.trim() || rejectMutation.isPending}
                        isLoading={rejectMutation.isPending}
                        onClick={() =>
                          rejectMutation.mutate({
                            vendorId: selectedApp.vendorId,
                            reason: rejectReason,
                          })
                        }
                      >
                        Confirm Rejection
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer Actions */}
            <Drawer.Footer className="border-t border-ui-border-base pt-4 flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={() => setSelectedApp(null)}
              >
                Close
              </Button>

              {!isRejecting && (
                <div className="flex items-center gap-x-2">
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => setIsRejecting(true)}
                  >
                    Request Changes
                  </Button>
                  <Button
                    variant="primary"
                    size="small"
                    disabled={approveMutation.isPending}
                    isLoading={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(selectedApp.vendorId)}
                  >
                    Approve Application
                  </Button>
                </div>
              )}
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Vendor Applications",
  icon: ShieldCheck,
})

export default VendorApplicationsPage
