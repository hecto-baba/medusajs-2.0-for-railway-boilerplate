"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  FocusModal,
  Heading,
  Text,
  Badge,
  Button,
  Input,
  Label,
  Select,
  Switch,
  toast,
} from "@medusajs/ui"
import {
  MagnifyingGlass,
  Sparkles,
  CheckCircleSolid,
  BuildingStorefront,
  ArrowRight,
  Plus,
  Photo,
  XMark,
} from "@medusajs/icons"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useVendorOnboardingStatus } from "@modules/onboarding"
import {
  useMasterProducts,
  useMasterProductFacets,
  useMasterProductDetail,
  useDebounce,
} from "@lib/hooks/use-master-catalog"
import { resolveMedusaCategory } from "@lib/data/category-resolver"
import {
  createVendorProduct,
  listVendorProducts,
  getTrustClawSegments,
} from "@lib/data/vendor-client"
import type { MasterCatalogItem, UnifiedMasterProduct } from "@typings/master-catalog"

interface AddProductModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddProductModal({ open, onOpenChange }: AddProductModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // 1. Get Vendor's Business Vertical / Segment with taxonomy resolution
  const { data: onboarding } = useVendorOnboardingStatus()
  const { data: segments = [] } = useQuery({
    queryKey: ["tc-segments"],
    queryFn: getTrustClawSegments,
    staleTime: 10 * 60 * 1000,
  })

  const matchedSegment = segments.find(
    (s) =>
      (onboarding?.segment?.code && s.code === onboarding.segment.code) ||
      (onboarding?.segmentId && s.id === onboarding.segmentId) ||
      (onboarding?.segmentId && s.code === onboarding.segmentId) ||
      (onboarding?.segment?.name &&
        s.name?.toLowerCase() === onboarding.segment.name.toLowerCase())
  )

  const effectiveSegmentCode =
    matchedSegment?.code ||
    onboarding?.segment?.code ||
    (onboarding?.segmentId && !onboarding.segmentId.includes("-") ? onboarding.segmentId : undefined) ||
    "HEALTHCARE"

  const segmentName =
    matchedSegment?.name ||
    onboarding?.segment?.name ||
    effectiveSegmentCode

  // 2. Active Tab Mode: "master" | "custom"
  const [activeTab, setActiveTab] = useState<"master" | "custom">("master")

  // 3. Search & Filtering State
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [selectedL1, setSelectedL1] = useState<string>("ALL")
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL")
  const [page, setPage] = useState(1)
  const limit = 20

  // 4. Master Catalog Query (strictly scoped to effectiveSegmentCode)
  const {
    data: catalogData,
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useMasterProducts(
    {
      segmentCode: effectiveSegmentCode,
      search: debouncedSearch || undefined,
      l1Category: selectedL1 !== "ALL" ? selectedL1 : undefined,
      brand: selectedBrand !== "ALL" ? selectedBrand : undefined,
      page,
      limit,
    },
    Boolean(effectiveSegmentCode) && open && activeTab === "master"
  )

  // 5. Facets for Filtering
  const { data: facets } = useMasterProductFacets(
    { segmentCode: effectiveSegmentCode },
    Boolean(effectiveSegmentCode) && open && activeTab === "master"
  )

  // 6. Vendor's existing products to flag already cloned items
  const [existingMasterProductIds, setExistingMasterProductIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!open) return
    listVendorProducts({ limit: 100, offset: 0 })
      .then((res) => {
        const ids = new Set<string>()
        res.products.forEach((p) => {
          if (p.metadata?.trustclaw_product_id) {
            ids.add(String(p.metadata.trustclaw_product_id))
          }
        })
        setExistingMasterProductIds(ids)
      })
      .catch(() => {})
  }, [open])

  // 7. Selected Master Product for Clone Drawer
  const [selectedItem, setSelectedItem] = useState<MasterCatalogItem | null>(null)
  const { data: fullProductDetail, isLoading: isDetailLoading } = useMasterProductDetail(
    selectedItem?.id || null,
    effectiveSegmentCode
  )

  // Clone Configuration Form State
  const [sellingPrice, setSellingPrice] = useState<string>("")
  const [stockQuantity, setStockQuantity] = useState<string>("20")
  const [customSku, setCustomSku] = useState<string>("")
  const [manageInventory, setManageInventory] = useState<boolean>(true)
  const [isCloning, setIsCloning] = useState<boolean>(false)

  // When a master product is selected, initialize form values
  useEffect(() => {
    if (selectedItem) {
      const suggested =
        fullProductDetail?.priceGuide?.min ??
        fullProductDetail?.priceGuide?.max ??
        selectedItem.priceMin ??
        selectedItem.priceMax ??
        100
      setSellingPrice(String(suggested))
      setStockQuantity("20")
      const randomSuffix = Math.floor(1000 + Math.random() * 9000)
      const cleanTitle = (fullProductDetail?.title || selectedItem.title || "PROD")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 6)
        .toUpperCase()
      setCustomSku(`${cleanTitle}-${randomSuffix}`)
      setManageInventory(true)
    }
  }, [selectedItem, fullProductDetail])

  // Handle Cloning
  const handleCloneProduct = async () => {
    if (!selectedItem) return

    const priceNum = parseFloat(sellingPrice)
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Please provide a valid selling price greater than 0.")
      return
    }

    const qtyNum = parseInt(stockQuantity, 10)
    if (manageInventory && (isNaN(qtyNum) || qtyNum < 0)) {
      toast.error("Please provide a valid stock quantity.")
      return
    }

    setIsCloning(true)
    try {
      const title = fullProductDetail?.title || selectedItem.title
      const description = fullProductDetail?.description || undefined
      const thumbnail =
        fullProductDetail?.thumbnail ||
        selectedItem.thumbnail ||
        selectedItem.imageUrl ||
        undefined

      // 1. Resolve Medusa category
      const resolvedMedusaCatId = await resolveMedusaCategory(
        fullProductDetail?.category?.code,
        fullProductDetail?.category?.id
      )

      // 2. Format images array
      const imagesPayload = fullProductDetail?.images?.length
        ? fullProductDetail.images.map((img) => ({ url: img.url }))
        : thumbnail
        ? [{ url: thumbnail }]
        : undefined

      // 3. Build product payload
      const payload: Record<string, unknown> = {
        title,
        description,
        thumbnail,
        images: imagesPayload,
        status: "published",
        discountable: true,
        categories: resolvedMedusaCatId ? [{ id: resolvedMedusaCatId }] : undefined,
        options: [{ title: "Default", values: ["Default"] }],
        variants: [
          {
            title: "Default",
            sku: customSku.trim() || undefined,
            manage_inventory: manageInventory,
            metadata: {
              inventory_quantity: manageInventory ? qtyNum : undefined,
            },
            prices: [
              {
                currency_code: "inr",
                amount: priceNum,
              },
            ],
            options: { Default: "Default" },
          },
        ],
        metadata: {
          is_master_clone: true,
          trustclaw_product_id: selectedItem.id,
          trustclaw_segment_code: effectiveSegmentCode,
          trustclaw_category_code: fullProductDetail?.category?.code || null,
          brand: fullProductDetail?.brand || selectedItem.brand || null,
          attributes: fullProductDetail?.attributes || {},
        },
      }

      const res = await createVendorProduct(payload)

      toast.success(`"${title}" successfully added to your store!`)
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
      setExistingMasterProductIds((prev) => new Set(prev).add(selectedItem.id))
      setSelectedItem(null)
      onOpenChange(false)

      if (res?.product?.id) {
        router.push(`/products/${res.product.id}`)
      }
    } catch (err: any) {
      console.error("Cloning error:", err)
      toast.error(err.message || "Failed to clone product into store.")
    } finally {
      setIsCloning(false)
    }
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col overflow-hidden bg-ui-bg-subtle max-h-screen">
        {/* Modal Header */}
        <FocusModal.Header className="flex items-center justify-between border-b border-ui-border-base bg-ui-bg-base px-6 py-4">
          <div className="flex items-center gap-x-4">
            <div>
              <FocusModal.Title className="text-xl font-bold text-ui-fg-base">
                Add New Product
              </FocusModal.Title>
              <Text size="small" className="text-ui-fg-subtle">
                Choose a standardized item from TrustClaw Master Catalog or create a custom listing.
              </Text>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-ui-bg-subtle p-1 rounded-lg border border-ui-border-base">
            <button
              type="button"
              onClick={() => {
                setActiveTab("master")
                setSelectedItem(null)
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "master"
                  ? "bg-ui-bg-base text-ui-fg-base shadow-sm"
                  : "text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
            >
              <Sparkles className="size-4 text-ui-fg-interactive" />
              <span>TrustClaw Master Catalog</span>
              <Badge size="2xsmall" color="blue">
                {effectiveSegmentCode}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("custom")
                setSelectedItem(null)
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "custom"
                  ? "bg-ui-bg-base text-ui-fg-base shadow-sm"
                  : "text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
            >
              <Plus className="size-4" />
              <span>Custom Product</span>
            </button>
          </div>
        </FocusModal.Header>

        {/* Modal Body */}
        <FocusModal.Body className="flex-1 overflow-hidden p-0">
          {activeTab === "master" ? (
            <div className="flex h-full flex-col lg:flex-row overflow-hidden">
              {/* Left Column: Catalog Browser */}
              <div className="flex flex-1 flex-col overflow-hidden bg-ui-bg-subtle p-6">
                {/* Vertical Scoping Context Banner */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/20 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <BuildingStorefront className="size-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <Text size="small" className="font-semibold text-blue-900 dark:text-blue-200">
                        {segmentName} Catalog
                      </Text>
                      <Text size="xsmall" className="text-blue-700 dark:text-blue-400">
                        Only showing verified products approved for your registered business segment.
                      </Text>
                    </div>
                  </div>
                  <Badge color="blue" size="small" className="uppercase font-semibold">
                    Vertical Scoped: {effectiveSegmentCode}
                  </Badge>
                </div>

                {/* Search and Filters Bar */}
                <div className="mb-4 flex flex-wrap items-center gap-3 bg-ui-bg-base p-3 rounded-lg border border-ui-border-base shadow-sm">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[240px]">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ui-fg-muted" />
                    <Input
                      type="text"
                      placeholder={`Search ${segmentName.toLowerCase()} products by name, brand, or code...`}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setPage(1)
                      }}
                      className="pl-9"
                    />
                  </div>

                  {/* L1 Category Filter */}
                  {facets?.categories?.l1 && facets.categories.l1.length > 0 && (
                    <div className="w-[180px]">
                      <Select
                        value={selectedL1}
                        onValueChange={(val) => {
                          setSelectedL1(val)
                          setPage(1)
                        }}
                      >
                        <Select.Trigger>
                          <Select.Value placeholder="All Categories" />
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Item value="ALL">All Categories</Select.Item>
                          {facets.categories.l1.map((cat) => (
                            <Select.Item key={cat.name} value={cat.name}>
                              {cat.name} ({cat.count})
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </div>
                  )}

                  {/* Brand Filter */}
                  {facets?.brands && facets.brands.length > 0 && (
                    <div className="w-[160px]">
                      <Select
                        value={selectedBrand}
                        onValueChange={(val) => {
                          setSelectedBrand(val)
                          setPage(1)
                        }}
                      >
                        <Select.Trigger>
                          <Select.Value placeholder="All Brands" />
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Item value="ALL">All Brands</Select.Item>
                          {facets.brands.map((b) => (
                            <Select.Item key={b.name} value={b.name}>
                              {b.name} ({b.count})
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Catalog Grid View */}
                <div className="flex-1 overflow-y-auto pr-1">
                  {isCatalogLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-64 rounded-xl border border-ui-border-base bg-ui-bg-base p-4 animate-pulse flex flex-col justify-between"
                        >
                          <div className="w-full h-32 bg-ui-bg-subtle rounded-lg" />
                          <div className="h-4 bg-ui-bg-subtle rounded w-3/4 mt-3" />
                          <div className="h-3 bg-ui-bg-subtle rounded w-1/2" />
                          <div className="h-6 bg-ui-bg-subtle rounded w-1/3" />
                        </div>
                      ))}
                    </div>
                  ) : catalogError ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-ui-bg-base rounded-xl border border-ui-border-base">
                      <Text size="large" className="font-semibold text-ui-fg-error">
                        Unable to load Master Catalog
                      </Text>
                      <Text size="small" className="text-ui-fg-subtle mt-1">
                        {catalogError.message || "Failed to connect to TrustClaw API."}
                      </Text>
                    </div>
                  ) : !catalogData?.items || catalogData.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-ui-bg-base rounded-xl border border-ui-border-base">
                      <BuildingStorefront className="size-10 text-ui-fg-muted mb-2" />
                      <Text size="large" className="font-semibold text-ui-fg-base">
                        No products found
                      </Text>
                      <Text size="small" className="text-ui-fg-subtle max-w-md mt-1">
                        {searchQuery
                          ? `No items match "${searchQuery}" in ${segmentName}. Try adjusting your search or filters.`
                          : `No standardized items currently listed for ${segmentName}. You can create a custom product.`}
                      </Text>
                      <Button
                        variant="secondary"
                        size="small"
                        className="mt-4"
                        onClick={() => setActiveTab("custom")}
                      >
                        Create Custom Product Instead
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {catalogData.items.map((item) => {
                        const isAlreadyListed = existingMasterProductIds.has(item.id)
                        const isSelected = selectedItem?.id === item.id
                        const thumb = item.thumbnail || item.imageUrl

                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className={`group relative flex flex-col justify-between rounded-xl border p-4 bg-ui-bg-base cursor-pointer transition-all duration-200 hover:shadow-md ${
                              isSelected
                                ? "border-ui-border-interactive ring-2 ring-ui-border-interactive/30"
                                : "border-ui-border-base hover:border-ui-border-strong"
                            }`}
                          >
                            {/* Card Header & Thumbnail */}
                            <div>
                              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ui-bg-subtle mb-3 flex items-center justify-center border border-ui-border-base/50">
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={item.title || item.name}
                                    className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <Photo className="size-10 text-ui-fg-muted opacity-40" />
                                )}

                                {/* Already listed badge */}
                                {isAlreadyListed && (
                                  <div className="absolute top-2 right-2">
                                    <Badge color="green" size="small" className="flex items-center gap-1 shadow-sm">
                                      <CheckCircleSolid className="size-3" />
                                      In Store
                                    </Badge>
                                  </div>
                                )}
                              </div>

                              {/* Brand */}
                              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                {item.brand && (
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-ui-fg-muted">
                                    {item.brand}
                                  </span>
                                )}
                              </div>

                              {/* Title */}
                              <h3 className="text-sm font-semibold text-ui-fg-base line-clamp-2 mb-2 leading-snug">
                                {item.title || item.name}
                              </h3>
                            </div>

                            {/* Card Footer: Pricing and Action */}
                            <div className="pt-2 border-t border-ui-border-base flex items-center justify-between mt-auto">
                              <div>
                                <Text size="xsmall" className="text-ui-fg-muted">
                                  Price
                                </Text>
                                <Text size="base" className="font-bold text-ui-fg-base">
                                  {item.priceMin ? `₹${item.priceMin.toLocaleString("en-IN")}` : "₹100"}
                                </Text>
                              </div>

                              <Button
                                size="small"
                                variant={isSelected ? "primary" : "secondary"}
                                className="txt-compact-xsmall-plus"
                              >
                                {isAlreadyListed ? "Re-list" : "Select"}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Pagination Controls */}
                {catalogData && catalogData.pagination && catalogData.pagination.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between border-t border-ui-border-base bg-ui-bg-base px-4 py-2.5 rounded-lg">
                    <Text size="small" className="text-ui-fg-subtle">
                      Showing page {catalogData.pagination.page} of {catalogData.pagination.totalPages} (
                      {catalogData.pagination.total} total items)
                    </Text>
                    <div className="flex items-center gap-2">
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={page >= catalogData.pagination.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Clone & Configuration Drawer */}
              {selectedItem && (
                <div className="w-full lg:w-[420px] xl:w-[460px] border-l border-ui-border-base bg-ui-bg-base p-6 flex flex-col justify-between overflow-y-auto shadow-xl">
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-ui-border-base">
                      <div>
                        <Heading level="h3" className="text-lg font-bold">
                          Configure Listing
                        </Heading>
                        <Text size="small" className="text-ui-fg-subtle">
                          Set your store&apos;s price and stock before activating.
                        </Text>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(null)}
                        className="rounded p-1 text-ui-fg-muted hover:text-ui-fg-base hover:bg-ui-bg-subtle"
                      >
                        <XMark className="size-5" />
                      </button>
                    </div>

                    {/* Product Summary Preview */}
                    <div className="py-4 border-b border-ui-border-base">
                      <div className="flex gap-3">
                        <div className="size-20 shrink-0 rounded-lg border border-ui-border-base bg-ui-bg-subtle overflow-hidden flex items-center justify-center">
                          {selectedItem.thumbnail || selectedItem.imageUrl ? (
                            <img
                              src={selectedItem.thumbnail || selectedItem.imageUrl || ""}
                              alt={selectedItem.title}
                              className="size-full object-cover"
                            />
                          ) : (
                            <Photo className="size-8 text-ui-fg-muted" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {(fullProductDetail?.brand || selectedItem.brand) && (
                            <Badge size="2xsmall" color="blue" className="mb-1">
                              {fullProductDetail?.brand || selectedItem.brand}
                            </Badge>
                          )}
                          <h4 className="text-sm font-semibold text-ui-fg-base leading-snug line-clamp-2">
                            {fullProductDetail?.title || selectedItem.title}
                          </h4>
                          <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                            Segment: <strong className="text-ui-fg-base">{effectiveSegmentCode}</strong>
                            {fullProductDetail?.category?.name ? ` › ${fullProductDetail.category.name}` : ""}
                          </Text>
                        </div>
                      </div>

                      {/* Duplicate Warning */}
                      {existingMasterProductIds.has(selectedItem.id) && (
                        <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-2.5">
                          <CheckCircleSolid className="size-4 text-amber-600 shrink-0" />
                          <Text size="xsmall" className="text-amber-800 dark:text-amber-300">
                            You already have this product listed in your store. Cloning again will create another listing.
                          </Text>
                        </div>
                      )}
                    </div>

                    {/* Inputs Section */}
                    <div className="space-y-4 py-4">
                      {/* Selling Price */}
                      <div>
                        <Label size="small" weight="plus">
                          Selling Price (₹ INR) <span className="text-ui-fg-error">*</span>
                        </Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ui-fg-muted font-semibold">
                            ₹
                          </span>
                          <Input
                            type="number"
                            min="1"
                            step="any"
                            placeholder="Enter price"
                            value={sellingPrice}
                            onChange={(e) => setSellingPrice(e.target.value)}
                            className="pl-8 text-base font-medium"
                          />
                        </div>
                        {(fullProductDetail?.priceGuide?.min || selectedItem.priceMin) && (
                          <Text size="xsmall" className="text-ui-fg-muted mt-1">
                            Suggested price: ₹
                            {(fullProductDetail?.priceGuide?.min || selectedItem.priceMin || 0).toLocaleString("en-IN")}
                          </Text>
                        )}
                      </div>

                      {/* Manage Inventory Switch */}
                      <div className="flex items-center justify-between rounded-lg border border-ui-border-base p-3">
                        <div className="flex flex-col">
                          <Label size="small" weight="plus">
                            Track Inventory
                          </Label>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            Automatically decrement stock on orders.
                          </Text>
                        </div>
                        <Switch
                          checked={manageInventory}
                          onCheckedChange={setManageInventory}
                        />
                      </div>

                      {/* Initial Stock Quantity */}
                      {manageInventory && (
                        <div>
                          <Label size="small" weight="plus">
                            Initial Stock Quantity <span className="text-ui-fg-error">*</span>
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={stockQuantity}
                            onChange={(e) => setStockQuantity(e.target.value)}
                            className="mt-1"
                          />
                          <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                            Allocated automatically to your store&apos;s primary fulfillment location.
                          </Text>
                        </div>
                      )}

                      {/* Custom SKU */}
                      <div>
                        <Label size="small" weight="plus">
                          SKU (Stock Keeping Unit)
                        </Label>
                        <Input
                          type="text"
                          value={customSku}
                          onChange={(e) => setCustomSku(e.target.value)}
                          placeholder="e.g. PROD-10293"
                          className="mt-1 font-mono uppercase"
                        />
                      </div>

                      {/* Auto-populated Attributes Overview */}
                      {fullProductDetail?.attributes && Object.keys(fullProductDetail.attributes).length > 0 && (
                        <div className="rounded-lg bg-ui-bg-subtle p-3 border border-ui-border-base/70">
                          <Text size="xsmall" className="font-semibold uppercase tracking-wider text-ui-fg-subtle mb-2">
                            Master Attributes Included
                          </Text>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(fullProductDetail.attributes).slice(0, 6).map(([key, val]) => (
                              <span
                                key={key}
                                className="rounded bg-ui-bg-base px-2 py-0.5 text-[11px] border border-ui-border-base text-ui-fg-subtle"
                              >
                                <strong className="text-ui-fg-base">{key}:</strong> {String(val)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 border-t border-ui-border-base flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedItem(null)}
                      disabled={isCloning}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleCloneProduct}
                      isLoading={isCloning}
                      className="gap-2"
                    >
                      <span>Clone & List on Store</span>
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Custom Product Tab */
            <div className="flex h-full items-center justify-center p-8 bg-ui-bg-subtle">
              <div className="max-w-md w-full bg-ui-bg-base rounded-2xl border border-ui-border-base p-8 text-center shadow-lg">
                <div className="mx-auto size-16 rounded-2xl bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center mb-4">
                  <Plus className="size-8 text-ui-fg-interactive" />
                </div>

                <Heading level="h2" className="text-xl font-bold text-ui-fg-base mb-2">
                  Create Custom Product
                </Heading>
                <Text size="small" className="text-ui-fg-subtle mb-6">
                  Can&apos;t find your item in the Master Catalog? Add a unique or custom item with your own specifications, images, and category hierarchy.
                </Text>

                <div className="space-y-3">
                  <Link
                    href="/products/new"
                    onClick={() => onOpenChange(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-ui-button-inverted px-4 py-2.5 text-sm font-semibold text-ui-contrast-fg-primary shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <span>Open Custom Product Form</span>
                    <ArrowRight className="size-4" />
                  </Link>

                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setActiveTab("master")}
                  >
                    Back to Master Catalog
                  </Button>
                </div>
              </div>
            </div>
          )}
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
