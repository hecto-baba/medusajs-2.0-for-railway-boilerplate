import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath, CheckCircle, ChevronRight, Folder, SquaresPlus, Tag, XCircle } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  StatusBadge,
  Switch,
  Text,
  toast,
  Tooltip,
  useDataTable,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { sdk } from "../../lib/sdk"
import type {
  TrustClawSegment,
  TrustClawCategory,
  TrustClawVendorCategory,
} from "../../types/trustclaw"

const NONE = "__none__"

const columnHelper = createDataTableColumnHelper<TrustClawSegment>()

// ── Level badge colors ──
const levelColors: Record<number, "blue" | "purple" | "orange" | "grey"> = {
  1: "blue",
  2: "purple",
  3: "orange",
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Card – a self-contained, overflow-safe card for a single category
// ─────────────────────────────────────────────────────────────────────────────
function CategoryCard({
  cat,
  depth = 0,
  treeMode,
  onDrillDown,
}: {
  cat: TrustClawCategory
  depth?: number
  treeMode: boolean
  onDrillDown: (cat: TrustClawCategory) => void
}) {
  const isSynced = Boolean((cat as any).medusa_id)

  return (
    <div key={cat.id}>
      <button
        type="button"
        className={[
          "w-full text-left",
          "group flex flex-col gap-1.5 px-3 py-2.5",
          "transition-colors hover:bg-ui-bg-subtle-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-interactive focus-visible:ring-inset",
          cat.hasChildren && !treeMode ? "cursor-pointer" : "cursor-default",
        ].join(" ")}
        style={depth > 0 ? { paddingLeft: `${12 + depth * 16}px` } : undefined}
        onClick={() => {
          if (cat.hasChildren && !treeMode) onDrillDown(cat)
        }}
        tabIndex={0}
        aria-label={`${cat.name}, Level ${cat.level}${cat.hasChildren ? ", has subcategories" : ", leaf category"}`}
      >
        {/* ── Row 1: Icon + Name + Level badge ── */}
        <div className="flex items-center gap-2 min-w-0">
          <Folder className="h-4 w-4 text-ui-fg-muted shrink-0" />
          <span className="text-ui-fg-base txt-compact-small-plus truncate">
            {cat.name}
          </span>
          <Badge
            size="2xsmall"
            color={levelColors[cat.level] ?? "grey"}
            className="shrink-0"
          >
            L{cat.level}
          </Badge>
          {isSynced ? (
            <Tooltip content="Synced to Medusa product categories">
              <span>
                <CheckCircle className="h-3.5 w-3.5 text-ui-tag-green-icon shrink-0" />
              </span>
            </Tooltip>
          ) : (
            <Tooltip content="Not yet synced — run Sync Categories">
              <span>
                <XCircle className="h-3.5 w-3.5 text-ui-tag-orange-icon shrink-0" />
              </span>
            </Tooltip>
          )}
        </div>

        {/* ── Row 2: Metadata chips ── */}
        <div className="flex items-center gap-1.5 pl-6 flex-wrap">
          <span className="txt-compact-xsmall text-ui-fg-muted font-mono truncate max-w-[140px]">
            {cat.code}
          </span>
          {cat.path && (
            <span className="txt-compact-xsmall text-ui-fg-disabled font-mono truncate max-w-[160px]">
              {cat.path}
            </span>
          )}
          {cat.segment && (
            <Badge size="2xsmall" color="purple" className="shrink-0">
              {cat.segment.name}
            </Badge>
          )}
          {cat.hasChildren ? (
            <Badge size="2xsmall" className="shrink-0 bg-ui-bg-subtle text-ui-fg-subtle" rounded="full">
              {cat.childCount} sub
            </Badge>
          ) : (
            <Badge size="2xsmall" color="grey" className="shrink-0 inline-flex items-center gap-0.5">
              <Tag className="h-3 w-3" />
              Leaf
            </Badge>
          )}
          {cat.hasChildren && !treeMode && (
            <ChevronRight className="h-3.5 w-3.5 text-ui-fg-muted ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </button>

      {/* ── Tree mode: nested children ── */}
      {treeMode && cat.children && cat.children.length > 0 && (
        <div className="border-l border-ui-border-base ml-5">
          {cat.children.map((child) => (
            <CategoryCard
              key={child.id}
              cat={child}
              depth={depth + 1}
              treeMode={treeMode}
              onDrillDown={onDrillDown}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader for category cards
// ─────────────────────────────────────────────────────────────────────────────
function CategorySkeleton() {
  return (
    <div className="animate-pulse space-y-0.5">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-ui-bg-subtle-pressed shrink-0" />
            <div className="h-4 rounded bg-ui-bg-subtle-pressed" style={{ width: `${50 + Math.random() * 100}px` }} />
            <div className="h-4 w-8 rounded bg-ui-bg-subtle-pressed shrink-0" />
          </div>
          <div className="flex items-center gap-1.5 pl-6">
            <div className="h-3 w-20 rounded bg-ui-bg-subtle-pressed" />
            <div className="h-3 w-14 rounded bg-ui-bg-subtle-pressed" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
const SegmentsPage = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedSegment, setSelectedSegment] = useState<TrustClawSegment | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<TrustClawCategory[]>([])

  // ── Advanced category filters ──
  const [levelFilter, setLevelFilter] = useState("")
  const [leafOnlyFilter, setLeafOnlyFilter] = useState(false)
  const [catSearch, setCatSearch] = useState("")
  const [vcFilterId, setVcFilterId] = useState("")
  const [treeMode, setTreeMode] = useState(false)

  const resetFilters = () => {
    setLevelFilter("")
    setLeafOnlyFilter(false)
    setCatSearch("")
    setVcFilterId("")
    setBreadcrumb([])
  }

  const closeDrawer = () => {
    setSelectedSegment(null)
    setBreadcrumb([])
    setLevelFilter("")
    setLeafOnlyFilter(false)
    setCatSearch("")
    setVcFilterId("")
    setTreeMode(false)
  }

  // ── Segments query ──
  const { data, isLoading, refetch, isRefetching } = useQuery<{
    segments: TrustClawSegment[]
    count: number
  }>({
    queryKey: ["admin-taxonomy-segments"],
    queryFn: () =>
      sdk.client.fetch<{ segments: TrustClawSegment[]; count: number }>(
        "/admin/taxonomy/segments"
      ),
    staleTime: 5 * 60 * 1000,
  })

  // ── Categories query ──
  const currentParentId =
    breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : undefined

  const hasAdvancedFilters = Boolean(levelFilter || leafOnlyFilter || catSearch || vcFilterId)

  const categoryQueryParams = useMemo(() => {
    const params: Record<string, string> = {
      segmentCode: selectedSegment?.code || "",
    }

    if (!hasAdvancedFilters) {
      params.parentId = currentParentId ?? "null"
    }

    if (levelFilter) params.level = levelFilter
    if (leafOnlyFilter) params.hasChildren = "false"
    if (catSearch) params.search = catSearch
    if (vcFilterId) params.vendorCategoryId = vcFilterId
    if (treeMode && !hasAdvancedFilters) params.tree = "true"

    return params
  }, [
    selectedSegment?.code,
    currentParentId,
    hasAdvancedFilters,
    levelFilter,
    leafOnlyFilter,
    catSearch,
    vcFilterId,
    treeMode,
  ])

  const { data: catData, isLoading: catLoading } = useQuery<{
    categories: TrustClawCategory[]
  }>({
    queryKey: ["admin-taxonomy-categories", categoryQueryParams],
    queryFn: () =>
      sdk.client.fetch<{ categories: TrustClawCategory[] }>(
        "/admin/taxonomy/tc-categories",
        { query: categoryQueryParams }
      ),
    enabled: Boolean(selectedSegment),
    staleTime: 5 * 60 * 1000,
  })

  // ── Vendor categories for filter dropdown ──
  const { data: vcData } = useQuery<{
    vendor_categories: TrustClawVendorCategory[]
  }>({
    queryKey: ["admin-taxonomy-segment-vendor-categories", selectedSegment?.code],
    queryFn: () =>
      sdk.client.fetch<{ vendor_categories: TrustClawVendorCategory[] }>(
        "/admin/taxonomy/vendor-categories",
        { query: { segmentCode: selectedSegment?.code || "", level: "1" } }
      ),
    enabled: Boolean(selectedSegment),
    staleTime: 10 * 60 * 1000,
  })

  const segmentVendorCategories = vcData?.vendor_categories ?? []

  // ── Sync Mutation ──
  const { mutateAsync: syncTaxonomy, isPending: isSyncing } = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{
        success: boolean
        created: number
        updated: number
        failed: number
        totalSynced: number
      }>("/admin/taxonomy/sync", { method: "POST" }),
    onSuccess: (res) => {
      toast.success(
        `Taxonomy synced! Created: ${res.created}, Updated: ${res.updated}, Failed: ${res.failed}`
      )
      queryClient.invalidateQueries({ queryKey: ["admin-taxonomy-segments"] })
      queryClient.invalidateQueries({ queryKey: ["admin-taxonomy-categories"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to sync taxonomy from TrustClaw.")
    },
  })

  // ── Local search ──
  const rawSegments = data?.segments ?? []
  const segments = useMemo(() => {
    if (!search.trim()) return rawSegments
    const q = search.toLowerCase().trim()
    return rawSegments.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
    )
  }, [rawSegments, search])

  // ── Table columns ──
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Segment",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-ui-bg-subtle-pressed flex items-center justify-center font-bold text-xs text-ui-fg-subtle shrink-0">
              {row.original.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <Text size="small" weight="plus" className="text-ui-fg-base truncate">
                {row.original.name}
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted font-mono truncate">
                {row.original.code}
              </Text>
            </div>
          </div>
        ),
      }),
      columnHelper.accessor("categoryCount", {
        header: "Size",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <Text size="xsmall" className="text-ui-fg-base tabular-nums">
              {row.original.categoryCount || 0} categories
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted tabular-nums">
              {row.original.vendorCategoryCount || 0} store types
            </Text>
          </div>
        ),
      }),
      columnHelper.accessor("orderType", {
        header: "Type",
        cell: ({ row }) => (
          <Badge size="2xsmall" color="blue">
            {row.original.orderType || "BUY"}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge color={row.original.isActive ? "green" : "grey"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                setSelectedSegment(row.original)
                setBreadcrumb([])
                resetFilters()
                setTreeMode(false)
              }}
            >
              Browse
            </Button>
          </div>
        ),
      }),
    ],
    []
  )

  const table = useDataTable({
    data: segments,
    columns,
    rowCount: segments.length,
    getRowId: (row) => row.id,
    isLoading,
    search: {
      state: search,
      onSearchChange: setSearch,
    },
  })

  const categories = catData?.categories ?? []

  return (
    <Container className="divide-y p-0 overflow-hidden">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col gap-3 p-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Heading level="h2">Industry Segments</Heading>
                <Badge size="2xsmall" color="purple">
                  TrustClaw
                </Badge>
              </div>
              <Text size="small" className="text-ui-fg-subtle mt-0.5">
                Business verticals and product classification taxonomy.
              </Text>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="small"
                onClick={() => refetch()}
                isLoading={isRefetching}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="small"
                onClick={() => syncTaxonomy()}
                isLoading={isSyncing}
              >
                <ArrowPath className="mr-1 h-3.5 w-3.5" />
                Sync
              </Button>
            </div>
          </div>
          <DataTable.Search placeholder="Search segments..." />
        </DataTable.Toolbar>
        <DataTable.Table />
      </DataTable>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  Category Explorer Drawer                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Drawer
        open={Boolean(selectedSegment)}
        onOpenChange={(open) => {
          if (!open) closeDrawer()
        }}
      >
        <Drawer.Content className="overflow-hidden flex flex-col max-h-screen">
          <Drawer.Header className="shrink-0">
            <Drawer.Title className="truncate">
              {selectedSegment ? `${selectedSegment.name} — Categories` : "Categories"}
            </Drawer.Title>
            <Drawer.Description className="line-clamp-2">
              Browse the hierarchical product taxonomy. Use filters to narrow
              results by level, leaf status, or vendor store type.
            </Drawer.Description>
          </Drawer.Header>

          {/* Scrollable body */}
          <Drawer.Body className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-y-3 px-4 py-3">
            {/* ── Filter Panel ── */}
            <div
              className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 space-y-2.5 shrink-0"
              role="search"
              aria-label="Category filters"
            >
              <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase tracking-wider">
                Filters
              </Text>

              {/* Search input — full width */}
              <Input
                placeholder="Search by name or code..."
                value={catSearch}
                onChange={(e) => {
                  setCatSearch(e.target.value)
                  if (e.target.value) setBreadcrumb([])
                }}
                size="small"
                aria-label="Search categories"
              />

              {/* Filter selects — stacked on narrow, side-by-side on wider */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select
                  value={levelFilter || NONE}
                  onValueChange={(v) => {
                    setLevelFilter(v === NONE ? "" : v)
                    if (v !== NONE) setBreadcrumb([])
                  }}
                >
                  <Select.Trigger aria-label="Filter by level">
                    <Select.Value placeholder="All Levels" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={NONE}>All Levels</Select.Item>
                    <Select.Item value="1">L1 — Root</Select.Item>
                    <Select.Item value="2">L2 — Sub</Select.Item>
                    <Select.Item value="3">L3 — Leaf</Select.Item>
                    <Select.Item value="1,2">L1 + L2</Select.Item>
                    <Select.Item value="2,3">L2 + L3</Select.Item>
                  </Select.Content>
                </Select>

                {segmentVendorCategories.length > 0 && (
                  <Select
                    value={vcFilterId || NONE}
                    onValueChange={(v) => {
                      setVcFilterId(v === NONE ? "" : v)
                      if (v !== NONE) setBreadcrumb([])
                    }}
                  >
                    <Select.Trigger aria-label="Filter by store type">
                      <Select.Value placeholder="All Store Types" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value={NONE}>All Store Types</Select.Item>
                      {segmentVendorCategories.map((vc) => (
                        <Select.Item key={vc.id} value={vc.id}>
                          {vc.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                )}
              </div>

              {/* Toggles row */}
              <div className="flex items-center gap-4 flex-wrap">
                <label htmlFor="leaf-only-toggle" className="flex items-center gap-1.5 cursor-pointer">
                  <Switch
                    id="leaf-only-toggle"
                    checked={leafOnlyFilter}
                    onCheckedChange={(checked) => {
                      setLeafOnlyFilter(checked)
                      if (checked) setBreadcrumb([])
                    }}
                  />
                  <span className="txt-compact-xsmall text-ui-fg-subtle select-none">
                    Leaf only
                  </span>
                </label>
                <label htmlFor="tree-toggle" className="flex items-center gap-1.5 cursor-pointer">
                  <Switch
                    id="tree-toggle"
                    checked={treeMode}
                    onCheckedChange={(checked) => {
                      setTreeMode(checked)
                      if (checked) setBreadcrumb([])
                    }}
                  />
                  <span className="txt-compact-xsmall text-ui-fg-subtle select-none">
                    Tree view
                  </span>
                </label>
                {hasAdvancedFilters && (
                  <button
                    type="button"
                    className="txt-compact-xsmall text-ui-fg-interactive hover:underline ml-auto"
                    onClick={resetFilters}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* ── Breadcrumb (only shown when no advanced filters) ── */}
            {!hasAdvancedFilters && breadcrumb.length > 0 && (
              <nav
                aria-label="Category breadcrumb"
                className="flex items-center gap-1 px-1 py-1.5 overflow-x-auto shrink-0"
              >
                <button
                  type="button"
                  className="txt-compact-xsmall text-ui-fg-interactive hover:underline whitespace-nowrap shrink-0"
                  onClick={() => setBreadcrumb([])}
                >
                  {selectedSegment?.code ?? "Root"}
                </button>
                {breadcrumb.map((crumb, idx) => (
                  <span key={crumb.id} className="flex items-center gap-1 shrink-0">
                    <ChevronRight className="h-3 w-3 text-ui-fg-muted" />
                    <button
                      type="button"
                      className={[
                        "txt-compact-xsmall whitespace-nowrap",
                        idx === breadcrumb.length - 1
                          ? "font-medium text-ui-fg-base"
                          : "text-ui-fg-interactive hover:underline",
                      ].join(" ")}
                      onClick={() => setBreadcrumb((prev) => prev.slice(0, idx + 1))}
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </nav>
            )}

            {/* ── Result count ── */}
            {!catLoading && categories.length > 0 && (
              <Text size="xsmall" className="text-ui-fg-subtle px-1 shrink-0">
                {categories.length} categor{categories.length === 1 ? "y" : "ies"}
                {hasAdvancedFilters && " (filtered)"}
              </Text>
            )}

            {/* ── Category list / states ── */}
            {catLoading ? (
              <CategorySkeleton />
            ) : categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <Folder className="h-8 w-8 text-ui-fg-disabled" />
                <Text size="small" className="text-ui-fg-muted">
                  {hasAdvancedFilters
                    ? "No categories match the current filters."
                    : "No subcategories at this level."}
                </Text>
                {hasAdvancedFilters && (
                  <Button variant="transparent" size="small" onClick={resetFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div
                className="flex flex-col divide-y border rounded-lg overflow-hidden"
                role="list"
                aria-label="Categories"
              >
                {categories.map((cat) => (
                  <CategoryCard
                    key={cat.id}
                    cat={cat}
                    treeMode={treeMode}
                    onDrillDown={(c) => setBreadcrumb((prev) => [...prev, c])}
                  />
                ))}
              </div>
            )}
          </Drawer.Body>

          <Drawer.Footer className="shrink-0">
            <Button size="small" variant="secondary" onClick={closeDrawer}>
              Close
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Segments",
  icon: SquaresPlus,
})

export default SegmentsPage
