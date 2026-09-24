"use client"

import {
  getTrustClawSegments,
  getTrustClawCategories,
  type TrustClawSegment,
  type TrustClawCategory,
} from "@lib/data/vendor-client"
import { useVendorOnboardingStatus } from "@modules/onboarding"
import {
  Badge,
  Button,
  Label,
  Select,
  Text,
} from "@medusajs/ui"
import {
  ArrowLeft,
  BuildingStorefront,
  CheckCircle,
  ChevronRight,
  Folder,
  Tag,
  XMark,
} from "@medusajs/icons"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

interface Props {
  /** Called with the category ID and name once the seller selects a category */
  onSelectCategory: (
    categoryId: string,
    name: string,
    category?: TrustClawCategory
  ) => void
  /** Currently selected category id */
  selectedMedusaCategoryId?: string | null
  /** Optional pre-filled category name or path for display in edit mode */
  selectedCategoryName?: string | null
  /** Optional segment code override */
  vendorSegmentCode?: string
}

const NONE = "__none__"

const levelColors: Record<number, "blue" | "purple" | "orange" | "grey"> = {
  1: "blue",
  2: "purple",
  3: "orange",
}

export function TrustClawCategoryPicker({
  onSelectCategory,
  selectedMedusaCategoryId,
  selectedCategoryName,
  vendorSegmentCode: propSegmentCode,
}: Props) {
  // Fetch vendor's registered onboarding details
  const { data: onboarding, isLoading: onboardingLoading } = useVendorOnboardingStatus()

  // Selected category state for instant feedback
  const [chosenCat, setChosenCat] = useState<{
    id: string
    name: string
    code?: string
    path?: string
    level?: number
    segmentName?: string
  } | null>(
    selectedMedusaCategoryId
      ? {
          id: selectedMedusaCategoryId,
          name: selectedCategoryName || "Assigned Category",
        }
      : null
  )

  const [isEditing, setIsEditing] = useState<boolean>(!selectedMedusaCategoryId)

  // Fetch Segments list
  const { data: segments = [], isLoading: segmentsLoading } = useQuery({
    queryKey: ["tc-segments"],
    queryFn: getTrustClawSegments,
    staleTime: 10 * 60 * 1000,
  })

  const safeSegments = Array.isArray(segments) ? segments : []

  // 1. Resolve vendor's effective segment code — memoized so .find() doesn't
  //    return a new reference on every render and trigger infinite useEffect loops.
  const effectiveVendorSegmentCode = useMemo(() => {
    return (
      propSegmentCode ||
      onboarding?.segment?.code ||
      safeSegments.find(
        (s) =>
          s.id === onboarding?.segmentId ||
          s.code === onboarding?.segmentId ||
          (onboarding?.segment?.name &&
            s.name?.toLowerCase() === onboarding.segment.name.toLowerCase())
      )?.code ||
      undefined
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propSegmentCode, onboarding?.segment?.code, onboarding?.segment?.name, onboarding?.segmentId, segments])

  const isVendorScoped = Boolean(effectiveVendorSegmentCode)

  // ── Hierarchical Browse State ──
  const [selectedSegmentCode, setSelectedSegmentCode] = useState<string>(
    effectiveVendorSegmentCode || ""
  )
  const [breadcrumb, setBreadcrumb] = useState<TrustClawCategory[]>([])

  // Auto-synchronize locked segment once onboarding resolves.
  // NOTE: selectedSegmentCode is intentionally NOT in deps — adding it would
  // cause an infinite loop (effect sets it → triggers itself again).
  useEffect(() => {
    if (effectiveVendorSegmentCode && selectedSegmentCode !== effectiveVendorSegmentCode) {
      setSelectedSegmentCode(effectiveVendorSegmentCode)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveVendorSegmentCode])

  // ── Browse Drilldown Query ──
  const currentParentId =
    breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : undefined

  const { data: rawCategories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: [
      "tc-categories-browse",
      selectedSegmentCode,
      currentParentId ?? "root",
    ],
    queryFn: () =>
      getTrustClawCategories({
        segmentCode: selectedSegmentCode,
        parentId: currentParentId ?? "null",
      }),
    enabled: isEditing && Boolean(selectedSegmentCode),
    staleTime: 5 * 60 * 1000,
  })

  const categories = Array.isArray(rawCategories) ? rawCategories : []

  const currentSegment =
    safeSegments.find((s) => s.code === selectedSegmentCode) ||
    (onboarding?.segment?.code === selectedSegmentCode ? onboarding.segment : null)

  // ── Handlers ──
  const handleSelect = (cat: TrustClawCategory) => {
    const categoryId = cat.medusa_id || cat.id
    setChosenCat({
      id: categoryId,
      name: cat.name,
      code: cat.code,
      path: cat.path,
      level: cat.level,
      segmentName: cat.segment?.name || currentSegment?.name,
    })
    setIsEditing(false)
    onSelectCategory(categoryId, cat.name, cat)
  }

  const handleClear = () => {
    setChosenCat(null)
    setIsEditing(true)
    setBreadcrumb([])
    if (!isVendorScoped) {
      setSelectedSegmentCode("")
    }
    onSelectCategory("", "")
  }

  const handleDrillDown = (cat: TrustClawCategory) => {
    if (cat.hasChildren) {
      setBreadcrumb((prev) => [...prev, cat])
    } else {
      handleSelect(cat)
    }
  }

  const handleStepBack = () => {
    if (breadcrumb.length > 0) {
      setBreadcrumb((prev) => prev.slice(0, prev.length - 1))
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. Selected Category Card (Display mode)                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {chosenCat && !isEditing ? (
        <div className="flex flex-col gap-2 p-3.5 rounded-lg border border-ui-border-interactive bg-ui-bg-subtle-hover transition-all">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle className="h-4 w-4 text-ui-tag-green-icon shrink-0" />
              <span className="text-ui-fg-base font-semibold text-sm truncate">
                {chosenCat.name}
              </span>
              {chosenCat.level && (
                <Badge
                  size="2xsmall"
                  color={levelColors[chosenCat.level] ?? "grey"}
                  className="shrink-0"
                >
                  Level {chosenCat.level}
                </Badge>
              )}
              {chosenCat.segmentName && (
                <Badge size="2xsmall" color="purple" className="shrink-0">
                  {chosenCat.segmentName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="secondary"
                size="small"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Change Category
              </Button>
              <Button
                variant="transparent"
                size="small"
                type="button"
                onClick={handleClear}
                aria-label="Remove category"
              >
                <XMark className="h-4 w-4 text-ui-fg-muted" />
              </Button>
            </div>
          </div>

          {(chosenCat.path || chosenCat.code) && (
            <div className="flex items-center gap-2 pl-6 text-xs text-ui-fg-subtle flex-wrap">
              {chosenCat.code && (
                <span className="font-mono text-ui-fg-muted">
                  Code: {chosenCat.code}
                </span>
              )}
              {chosenCat.path && (
                <>
                  <span>•</span>
                  <span className="font-mono text-ui-fg-disabled truncate max-w-[320px]">
                    {chosenCat.path}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ═════════════════════════════════════════════════════════════════ */
        /* 2. Hierarchical Category Browser Container                        */
        /* ═════════════════════════════════════════════════════════════════ */
        <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-ui-fg-interactive" />
              <span className="txt-compact-small-plus text-ui-fg-base">
                Browse Category Hierarchy
              </span>
            </div>
            {chosenCat && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="txt-compact-xsmall text-ui-fg-interactive hover:underline"
              >
                Cancel / Keep current
              </button>
            )}
          </div>

          {/* ── Step 1: Industry Segment (Locked for Scoped Vendor / Select for Admin/Fallback) ── */}
          {isVendorScoped ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-ui-border-base bg-ui-bg-base shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ui-bg-subtle-hover text-ui-fg-interactive shrink-0">
                  <BuildingStorefront className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ui-fg-muted">
                    Your Business Segment
                  </span>
                  <span className="text-sm font-semibold text-ui-fg-base truncate">
                    {currentSegment?.name || onboarding?.segment?.name || selectedSegmentCode}
                  </span>
                </div>
              </div>
              <Badge color="blue" size="small" className="shrink-0 font-medium">
                {(currentSegment as any)?.orderType || "BUY"} • Scoped
              </Badge>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label size="small" weight="plus">
                1. Industry Segment
              </Label>
              <Select
                value={selectedSegmentCode || NONE}
                onValueChange={(v) => {
                  setSelectedSegmentCode(v === NONE ? "" : v)
                  setBreadcrumb([])
                }}
                disabled={segmentsLoading || onboardingLoading}
              >
                <Select.Trigger aria-label="Select segment">
                  <Select.Value placeholder="Select an industry segment (e.g. Fashion, Grocery, Electronics)…" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={NONE}>— Select segment —</Select.Item>
                  {safeSegments
                    .filter((seg) => Boolean(seg?.code))
                    .map((seg) => (
                      <Select.Item key={seg.id} value={String(seg.code)}>
                        {seg.name} ({seg.orderType || "BUY"})
                      </Select.Item>
                    ))}
                </Select.Content>
              </Select>
            </div>
          )}

          {/* ── Step 2: Category Hierarchy Navigation ── */}
          {selectedSegmentCode && (
            <div className="flex flex-col gap-2 pt-1 border-t border-ui-border-base">
              {/* Breadcrumb path navigation bar */}
              <div className="flex items-center justify-between gap-2 py-1">
                <div className="flex items-center gap-1 text-xs text-ui-fg-muted overflow-x-auto pb-0.5 min-w-0">
                  <button
                    type="button"
                    className="text-ui-fg-interactive hover:underline shrink-0 font-medium"
                    onClick={() => setBreadcrumb([])}
                  >
                    {currentSegment?.name || selectedSegmentCode}
                  </button>
                  {breadcrumb.map((crumb, idx) => (
                    <span
                      key={crumb.id}
                      className="flex items-center gap-1 shrink-0"
                    >
                      <ChevronRight className="h-3 w-3 text-ui-fg-muted" />
                      <button
                        type="button"
                        className={
                          idx === breadcrumb.length - 1
                            ? "font-semibold text-ui-fg-base"
                            : "text-ui-fg-interactive hover:underline"
                        }
                        onClick={() =>
                          setBreadcrumb((prev) => prev.slice(0, idx + 1))
                        }
                      >
                        {crumb.name}
                      </button>
                    </span>
                  ))}
                </div>

                {breadcrumb.length > 0 && (
                  <Button
                    variant="transparent"
                    size="small"
                    type="button"
                    onClick={handleStepBack}
                    className="shrink-0 text-xs text-ui-fg-subtle hover:text-ui-fg-base"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Back
                  </Button>
                )}
              </div>

              {/* Subcategories list header label */}
              <Label size="xsmall" className="text-ui-fg-subtle">
                {breadcrumb.length === 0
                  ? "Select Level 1 Root Category:"
                  : `Select Subcategory of "${breadcrumb[breadcrumb.length - 1].name}":`}
              </Label>

              {/* Categories list */}
              <div className="flex flex-col divide-y border border-ui-border-base rounded-lg overflow-hidden bg-ui-bg-base max-h-64 overflow-y-auto">
                {categoriesLoading ? (
                  <div className="p-6 text-center text-xs text-ui-fg-muted">
                    Loading categories…
                  </div>
                ) : categories.length === 0 ? (
                  <div className="p-6 text-center text-xs text-ui-fg-muted space-y-1">
                    <Folder className="h-6 w-6 text-ui-fg-disabled mx-auto mb-1" />
                    <p>No subcategories found at this level.</p>
                  </div>
                ) : (
                  categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleDrillDown(cat)}
                      className="group flex items-center justify-between p-2.5 hover:bg-ui-bg-subtle-hover text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-interactive"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Folder className="h-4 w-4 text-ui-fg-muted shrink-0 group-hover:text-ui-fg-interactive" />
                        <span className="text-ui-fg-base txt-compact-small-plus truncate">
                          {cat.name}
                        </span>
                        <Badge
                          size="2xsmall"
                          color={levelColors[cat.level] ?? "grey"}
                          className="shrink-0"
                        >
                          Level {cat.level}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        {cat.hasChildren ? (
                          <span className="txt-compact-xsmall text-ui-fg-muted flex items-center gap-1 group-hover:text-ui-fg-base transition-colors">
                            <span className="tabular-nums">{cat.childCount} sub</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <Badge
                            size="2xsmall"
                            color="green"
                            className="inline-flex items-center gap-0.5"
                          >
                            <Tag className="h-3 w-3" /> Select Leaf
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

