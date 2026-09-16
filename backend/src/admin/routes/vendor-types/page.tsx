import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront, CheckCircle, Folder, Tag } from "@medusajs/icons"
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
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { sdk } from "../../lib/sdk"
import type {
  TrustClawVendorType,
  TrustClawVendorCategory,
  TrustClawMappedCategory,
  TrustClawSegment,
} from "../../types/trustclaw"

const NONE = "__none__"

const columnHelper = createDataTableColumnHelper<TrustClawVendorType>()

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const VendorTypesPage = () => {
  const [search, setSearch] = useState("")
  const [segmentFilter, setSegmentFilter] = useState("")

  // ── Selected vendor type → vendor categories drawer
  const [selectedVendorType, setSelectedVendorType] =
    useState<TrustClawVendorType | null>(null)

  // ── Selected vendor category → P2V drawer
  const [selectedVendorCategory, setSelectedVendorCategory] =
    useState<TrustClawVendorCategory | null>(null)

  // ── Vendor categories filters
  const [vcLevelFilter, setVcLevelFilter] = useState("")
  const [vcOnboardingFilter, setVcOnboardingFilter] = useState("")
  const [vcSearch, setVcSearch] = useState("")

  // ===== SEGMENTS (for filter dropdowns) =====
  const { data: segmentsData } = useQuery<{ segments: TrustClawSegment[] }>({
    queryKey: ["admin-taxonomy-segments-list"],
    queryFn: () =>
      sdk.client.fetch<{ segments: TrustClawSegment[] }>(
        "/admin/taxonomy/segments"
      ),
    staleTime: 10 * 60 * 1000,
  })
  const segments = segmentsData?.segments ?? []

  // ===== VENDOR TYPES =====
  const { data: vtData, isLoading: vtLoading } = useQuery<{
    vendor_types: TrustClawVendorType[]
    count: number
  }>({
    queryKey: ["admin-taxonomy-vendor-types", segmentFilter],
    queryFn: () =>
      sdk.client.fetch<{
        vendor_types: TrustClawVendorType[]
        count: number
      }>("/admin/taxonomy/vendor-types", {
        query: {
          ...(segmentFilter ? { segmentCode: segmentFilter } : {}),
        },
      }),
    staleTime: 5 * 60 * 1000,
  })

  const rawVendorTypes = vtData?.vendor_types ?? []
  const vendorTypes = useMemo(() => {
    if (!search.trim()) return rawVendorTypes
    const q = search.toLowerCase().trim()
    return rawVendorTypes.filter(
      (vt) =>
        vt.name.toLowerCase().includes(q) ||
        vt.code.toLowerCase().includes(q) ||
        (vt.description && vt.description.toLowerCase().includes(q))
    )
  }, [rawVendorTypes, search])

  // ===== VENDOR CATEGORIES (for selected vendor type) =====
  const { data: vcData, isLoading: vcLoading } = useQuery<{
    vendor_categories: TrustClawVendorCategory[]
    count: number
  }>({
    queryKey: [
      "admin-taxonomy-vendor-categories",
      selectedVendorType?.code,
      vcLevelFilter,
      vcOnboardingFilter,
      vcSearch,
    ],
    queryFn: () =>
      sdk.client.fetch<{
        vendor_categories: TrustClawVendorCategory[]
        count: number
      }>("/admin/taxonomy/vendor-categories", {
        query: {
          vendorTypeCode: selectedVendorType?.code || "",
          ...(vcLevelFilter ? { level: vcLevelFilter } : {}),
          ...(vcOnboardingFilter ? { onboardingMode: vcOnboardingFilter } : {}),
          ...(vcSearch ? { search: vcSearch } : {}),
        },
      }),
    enabled: Boolean(selectedVendorType),
    staleTime: 5 * 60 * 1000,
  })

  const vendorCategories = vcData?.vendor_categories ?? []

  // ===== P2V MAPPED CATEGORIES (for selected vendor category) =====
  const { data: p2vData, isLoading: p2vLoading } = useQuery<{
    categories: TrustClawMappedCategory[]
  }>({
    queryKey: [
      "admin-taxonomy-p2v-categories",
      selectedVendorCategory?.id,
    ],
    queryFn: () =>
      sdk.client.fetch<{ categories: TrustClawMappedCategory[] }>(
        `/admin/taxonomy/vendor-categories/${selectedVendorCategory!.id}/categories`,
        { query: { parentId: "null" } }
      ),
    enabled: Boolean(selectedVendorCategory),
    staleTime: 5 * 60 * 1000,
  })

  const mappedCategories = p2vData?.categories ?? []

  // ===== TABLE COLUMNS =====
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Vendor Type",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ui-tag-purple-bg flex items-center justify-center font-bold text-xs text-ui-tag-purple-text shrink-0">
              {row.original.code.charAt(0)}
            </div>
            <div>
              <Text size="small" weight="plus" className="text-ui-fg-base">
                {row.original.name}
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted font-mono">
                {row.original.code}
              </Text>
            </div>
          </div>
        ),
      }),
      columnHelper.accessor("description", {
        header: "Description",
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle max-w-md truncate">
            {row.original.description || "—"}
          </Text>
        ),
      }),
      columnHelper.accessor("vendorCategoryCount", {
        header: "Store Types",
        cell: ({ row }) => (
          <Badge size="2xsmall" rounded="full" className="bg-ui-bg-subtle">
            {row.original.vendorCategoryCount} Classifications
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
                setSelectedVendorType(row.original)
                setSelectedVendorCategory(null)
                setVcSearch("")
                setVcLevelFilter("")
                setVcOnboardingFilter("")
              }}
            >
              Browse Store Types
            </Button>
          </div>
        ),
      }),
    ],
    []
  )

  const table = useDataTable({
    data: vendorTypes,
    columns,
    rowCount: vendorTypes.length,
    getRowId: (row) => row.id,
    isLoading: vtLoading,
    search: {
      state: search,
      onSearchChange: setSearch,
    },
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <Heading level="h2">Vendor Types & Store Classifications</Heading>
              <Badge size="2xsmall" color="purple">
                TrustClaw API
              </Badge>
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              Transaction modes (Order, Booking, Rental, …) and vendor store
              classifications synced from TrustClaw taxonomy.
            </Text>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <DataTable.Search placeholder="Search vendor type..." />
            <Select
              value={segmentFilter || NONE}
              onValueChange={(v) =>
                setSegmentFilter(v === NONE ? "" : v)
              }
            >
              <Select.Trigger className="min-w-[160px]">
                <Select.Value placeholder="All Segments" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={NONE}>All Segments</Select.Item>
                {segments.map((seg) => (
                  <Select.Item key={seg.id} value={seg.code}>
                    {seg.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </DataTable.Toolbar>
        <DataTable.Table />
      </DataTable>

      {/* ─── Vendor Categories Drawer ─── */}
      <Drawer
        open={Boolean(selectedVendorType) && !selectedVendorCategory}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedVendorType(null)
            setVcSearch("")
            setVcLevelFilter("")
            setVcOnboardingFilter("")
          }
        }}
      >
        <Drawer.Content className="overflow-hidden flex flex-col max-h-screen">
          <Drawer.Header className="shrink-0">
            <Drawer.Title className="truncate">
              {selectedVendorType
                ? `${selectedVendorType.name} — Store Types`
                : "Store Classifications"}
            </Drawer.Title>
            <Drawer.Description className="line-clamp-2">
              Vendor categories (store types) available under this transaction
              mode. Each classification defines commission rates and onboarding
              rules.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-y-3 px-4 py-3">
            {/* Filters panel */}
            <div
              className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 space-y-2.5 shrink-0"
              role="search"
              aria-label="Vendor category filters"
            >
              <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase tracking-wider">
                Filters
              </Text>
              <Input
                placeholder="Search store classifications..."
                value={vcSearch}
                onChange={(e) => setVcSearch(e.target.value)}
                size="small"
                aria-label="Search store classifications"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={vcLevelFilter || NONE}
                  onValueChange={(v) =>
                    setVcLevelFilter(v === NONE ? "" : v)
                  }
                >
                  <Select.Trigger aria-label="Filter by level">
                    <Select.Value placeholder="All Levels" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={NONE}>All Levels</Select.Item>
                    <Select.Item value="1">L1 — Root</Select.Item>
                    <Select.Item value="2">L2 — Sub-type</Select.Item>
                  </Select.Content>
                </Select>
                <Select
                  value={vcOnboardingFilter || NONE}
                  onValueChange={(v) =>
                    setVcOnboardingFilter(v === NONE ? "" : v)
                  }
                >
                  <Select.Trigger aria-label="Filter by onboarding mode">
                    <Select.Value placeholder="Onboarding Mode" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={NONE}>All Modes</Select.Item>
                    <Select.Item value="COMMON">Common</Select.Item>
                    <Select.Item value="SPECIALIZED">Specialized</Select.Item>
                  </Select.Content>
                </Select>
              </div>
            </div>

            {/* Vendor Categories Count */}
            {!vcLoading && vendorCategories.length > 0 && (
              <Text size="xsmall" className="text-ui-fg-subtle px-1 shrink-0">
                {vendorCategories.length} store classification{vendorCategories.length === 1 ? "" : "s"}
              </Text>
            )}

            {/* Vendor Categories List */}
            {vcLoading ? (
              <div className="p-8 text-center text-ui-fg-muted">
                <Text size="small">Loading vendor categories…</Text>
              </div>
            ) : vendorCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <Folder className="h-8 w-8 text-ui-fg-disabled" />
                <Text size="small" className="text-ui-fg-muted">
                  No vendor categories found for this type.
                </Text>
              </div>
            ) : (
              <div className="flex flex-col divide-y border rounded-lg overflow-hidden" role="list">
                {vendorCategories.map((vc) => (
                  <div
                    key={vc.id}
                    className="flex flex-col gap-2 p-3 hover:bg-ui-bg-subtle transition-colors"
                  >
                    {/* Row 1: Icon + Name + Level & Segment Badges */}
                    <div className="flex items-center gap-2 min-w-0">
                      <Folder className="h-4 w-4 text-ui-fg-muted shrink-0" />
                      <span className="text-ui-fg-base txt-compact-small-plus truncate">
                        {vc.name}
                      </span>
                      <Badge size="2xsmall" color="blue" className="shrink-0">
                        L{vc.level}
                      </Badge>
                      {vc.segment?.name && (
                        <Badge size="2xsmall" color="purple" className="shrink-0 truncate max-w-[120px]">
                          {vc.segment.name}
                        </Badge>
                      )}
                      {vc.onboardingMode && (
                        <Badge
                          size="2xsmall"
                          color={vc.onboardingMode === "SPECIALIZED" ? "orange" : "grey"}
                          className="shrink-0"
                        >
                          {vc.onboardingMode}
                        </Badge>
                      )}
                    </div>

                    {/* Row 2: Code + Commission + Child count + Path */}
                    <div className="flex items-center gap-2 pl-6 flex-wrap text-xs text-ui-fg-subtle">
                      <span className="font-mono text-ui-fg-muted truncate max-w-[120px]">
                        {vc.code}
                      </span>
                      <span>•</span>
                      <span>
                        Commission:{" "}
                        <span className="font-mono font-semibold text-ui-fg-base">
                          {vc.commissionPct}%
                        </span>
                        {vc.commissionFlat > 0 && (
                          <span className="ml-0.5 font-mono">
                            + ₹{vc.commissionFlat}
                          </span>
                        )}
                      </span>
                      {vc.childCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="tabular-nums">{vc.childCount} sub-types</span>
                        </>
                      )}
                      {vc.path && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-ui-fg-disabled truncate max-w-[140px]">
                            {vc.path}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Row 3: Action button */}
                    <div className="pl-6 pt-1">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setSelectedVendorCategory(vc)}
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        View Allowed Product Categories
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer className="shrink-0">
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                setSelectedVendorType(null)
                setVcSearch("")
                setVcLevelFilter("")
                setVcOnboardingFilter("")
              }}
            >
              Close
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* ─── P2V Mapped Product Categories Drawer ─── */}
      <Drawer
        open={Boolean(selectedVendorCategory)}
        onOpenChange={(open) => {
          if (!open) setSelectedVendorCategory(null)
        }}
      >
        <Drawer.Content className="overflow-hidden flex flex-col max-h-screen">
          <Drawer.Header className="shrink-0">
            <Drawer.Title className="truncate">
              {selectedVendorCategory
                ? `${selectedVendorCategory.name} — Product Categories`
                : "Mapped Product Categories"}
            </Drawer.Title>
            <Drawer.Description className="line-clamp-2">
              Product categories that vendors of this store type are permitted to
              sell. (Product-to-Vendor P2V mapping from TrustClaw).
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-y-3 px-4 py-3">
            {/* Vendor Category Summary */}
            {selectedVendorCategory && (
              <div className="p-3 rounded-lg bg-ui-bg-subtle border border-ui-border-base space-y-1.5 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Text size="small" weight="plus" className="text-ui-fg-base">
                    {selectedVendorCategory.name}
                  </Text>
                  <Badge size="2xsmall" color="blue">
                    L{selectedVendorCategory.level}
                  </Badge>
                  {selectedVendorCategory.segment?.name && (
                    <Badge size="2xsmall" color="purple">
                      {selectedVendorCategory.segment.name}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-ui-fg-muted font-mono flex-wrap">
                  <span>{selectedVendorCategory.code}</span>
                  <span>•</span>
                  <span>{selectedVendorCategory.vendorType?.name}</span>
                  <span>•</span>
                  <span>{selectedVendorCategory.onboardingMode}</span>
                  <span>•</span>
                  <span>{selectedVendorCategory.commissionPct}% commission</span>
                </div>
              </div>
            )}

            {/* Mapped Categories Count */}
            {!p2vLoading && mappedCategories.length > 0 && (
              <Text size="xsmall" className="text-ui-fg-subtle px-1 shrink-0">
                {mappedCategories.length} allowed categor{mappedCategories.length === 1 ? "y" : "ies"}
              </Text>
            )}

            {/* Mapped Categories List */}
            {p2vLoading ? (
              <div className="p-8 text-center text-ui-fg-muted">
                <Text size="small">Loading mapped product categories…</Text>
              </div>
            ) : mappedCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <Tag className="h-8 w-8 text-ui-fg-disabled" />
                <Text size="small" className="text-ui-fg-muted">
                  No product categories mapped to this vendor category.
                </Text>
              </div>
            ) : (
              <div className="flex flex-col divide-y border rounded-lg overflow-hidden" role="list">
                {mappedCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex flex-col gap-1.5 p-3 hover:bg-ui-bg-subtle transition-colors"
                  >
                    {/* Row 1: Icon + Name + Badges */}
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag className="h-4 w-4 text-ui-fg-muted shrink-0" />
                      <span className="text-ui-fg-base txt-compact-small-plus truncate">
                        {cat.name}
                      </span>
                      <Badge size="2xsmall" color="blue" className="shrink-0">
                        L{cat.level}
                      </Badge>
                      {cat.hasChildren ? (
                        <Badge size="2xsmall" color="grey" className="shrink-0">
                          Has Children
                        </Badge>
                      ) : (
                        <Badge size="2xsmall" color="green" className="shrink-0 inline-flex items-center gap-0.5">
                          <CheckCircle className="h-3 w-3" /> Leaf
                        </Badge>
                      )}
                    </div>

                    {/* Row 2: Code & Products */}
                    <div className="flex items-center gap-2 pl-6 flex-wrap text-xs text-ui-fg-subtle">
                      <span className="font-mono text-ui-fg-muted truncate max-w-[160px]">
                        {cat.code}
                      </span>
                      <span>•</span>
                      <span className="tabular-nums">
                        {cat.directProductCount} products mapped
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer className="shrink-0">
            <Button
              size="small"
              variant="secondary"
              onClick={() => setSelectedVendorCategory(null)}
            >
              ← Back to Store Types
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Vendor Types",
  icon: BuildingStorefront,
})

export default VendorTypesPage
