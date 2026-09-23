"use client"

import {
  createVendorProduct,
  createVendorProductTag,
  createVendorProductType,
  listVendorCollections,
  listVendorProductTags,
  listVendorProductTypes,
  listVendorSalesChannels,
  updateVendorProduct,
  type VendorCollection,
  type VendorProduct,
  type VendorProductTagItem,
  type VendorProductTypeItem,
  type VendorSalesChannel,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Checkbox,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Table,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { Plus, Trash, Sparkles } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { PriceFields } from "./detail/variant-drawer"
import { TrustClawCategoryPicker } from "./detail/trustclaw-category-picker"
import { TrustClawAttributesSection } from "./detail/trustclaw-attributes-section"

type ProductFormProps = {
  product?: VendorProduct
}

/** Groups fields into cards the way the admin's edit screens do. */
const Card = ({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) => (
  <div className="bg-ui-bg-base shadow-elevation-card-rest flex flex-col gap-y-4 rounded-lg p-6">
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-y-1">
        <Heading level="h2">{title}</Heading>
        {description ? (
          <Text size="small" className="text-ui-fg-subtle">
            {description}
          </Text>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
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

/**
 * A numeric field that keeps its value as a string.
 */
const NumberField = ({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) => (
  <Field id={id} label={label}>
    <Input
      id={id}
      type="number"
      min="0"
      step="any"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </Field>
)

/** "" -> undefined, so an untouched field is omitted rather than cleared. */
const text = (value: string) => value.trim() || undefined

/** "" -> null, so clearing a number field unsets it rather than sending NaN. */
const num = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

type FormOption = {
  title: string
  valuesString: string
}

type FormVariant = {
  id: string
  title: string
  options: Record<string, string>
  sku: string
  barcode: string
  price: string
  manage_inventory: boolean
  inventory_quantity: string
}

export const ProductForm = ({ product }: ProductFormProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isEdit = Boolean(product)

  // 1. General Info
  const [title, setTitle] = useState(product?.title ?? "")
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? "")
  const [handle, setHandle] = useState(product?.handle ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [status, setStatus] = useState(product?.status ?? "draft")
  const [discountable, setDiscountable] = useState(
    product?.discountable ?? true
  )
  const [categoryIds, setCategoryIds] = useState<string[]>(
    product?.categories?.map((c) => c.id) ?? []
  )

  // 2. Organize State
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    product?.type?.id ?? ""
  )
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    product?.collection?.id ?? ""
  )
  const [selectedTags, setSelectedTags] = useState<string[]>(
    product?.tags?.map((t) => t.value) ?? []
  )
  const [newTagInput, setNewTagInput] = useState("")
  const [selectedSalesChannelIds, setSelectedSalesChannelIds] = useState<string[]>(
    product?.sales_channels?.map((sc) => sc.id) ?? []
  )

  // Fetch organize datasets
  const { data: typesData } = useQuery({
    queryKey: ["vendor-product-types"],
    queryFn: () => listVendorProductTypes({ limit: 100, offset: 0 }),
  })
  const { data: collectionsData } = useQuery({
    queryKey: ["vendor-collections"],
    queryFn: () => listVendorCollections({ limit: 100, offset: 0 }),
  })
  const { data: tagsData } = useQuery({
    queryKey: ["vendor-product-tags"],
    queryFn: () => listVendorProductTags({ limit: 100, offset: 0 }),
  })
  const { data: salesChannelsData } = useQuery({
    queryKey: ["vendor-sales-channels"],
    queryFn: () => listVendorSalesChannels({ limit: 100, offset: 0 }),
  })

  const productTypes = typesData?.product_types ?? []
  const collections = collectionsData?.collections ?? []
  const existingTags = tagsData?.product_tags ?? []
  const salesChannels = salesChannelsData?.sales_channels ?? []

  // Initialize default sales channel if creating and channels loaded
  useEffect(() => {
    if (!isEdit && salesChannels.length > 0 && selectedSalesChannelIds.length === 0) {
      setSelectedSalesChannelIds(salesChannels.map((s) => s.id))
    }
  }, [isEdit, salesChannels, selectedSalesChannelIds.length])

  // 3. Variants & Options Configuration
  const [variantMode, setVariantMode] = useState<"single" | "multi">("single")
  
  // Single variant price
  const [prices, setPrices] = useState<Record<string, string>>({
    usd: "100",
  })
  const [singleSku, setSingleSku] = useState("")
  const [singleBarcode, setSingleBarcode] = useState("")
  const [singleManageInventory, setSingleManageInventory] = useState(true)
  const [singleQuantity, setSingleQuantity] = useState("20")

  // Multi-variant options
  const [options, setOptions] = useState<FormOption[]>([
    { title: "Size", valuesString: "S, M, L" },
  ])
  const [variants, setVariants] = useState<FormVariant[]>([])

  // Shortcuts batch inputs
  const [shortcutPrice, setShortcutPrice] = useState("")
  const [shortcutInventory, setShortcutInventory] = useState("")

  // Generate variants from options
  const handleGenerateVariants = () => {
    const activeOptions = options
      .map((opt) => ({
        title: opt.title.trim(),
        values: opt.valuesString
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      }))
      .filter((opt) => opt.title && opt.values.length > 0)

    if (!activeOptions.length) {
      toast.error("Please specify at least one option with values (e.g. Size: S, M, L)")
      return
    }

    let combinations: Record<string, string>[] = [{}]
    for (const opt of activeOptions) {
      const next: Record<string, string>[] = []
      for (const comb of combinations) {
        for (const val of opt.values) {
          next.push({
            ...comb,
            [opt.title]: val,
          })
        }
      }
      combinations = next
    }

    const defaultPrice = prices["usd"] || "100"
    const newVariants: FormVariant[] = combinations.map((comb, idx) => {
      const titleStr = Object.values(comb).join(" / ")
      const cleanHandle = handle.trim() || title.toLowerCase().replace(/[^a-z0-9]/g, "-") || "prod"
      const skuSuffix = Object.values(comb).join("-").toUpperCase()
      return {
        id: `var-${idx}`,
        title: titleStr,
        options: comb,
        sku: `${cleanHandle}-${skuSuffix}`.replace(/--+/g, "-"),
        barcode: "",
        price: defaultPrice,
        manage_inventory: true,
        inventory_quantity: "20",
      }
    })

    setVariants(newVariants)
    toast.success(`Generated ${newVariants.length} variant combinations!`)
  }

  // Shortcuts actions
  const applyPriceToAll = () => {
    if (!shortcutPrice || isNaN(Number(shortcutPrice))) {
      toast.error("Please enter a valid price to apply.")
      return
    }
    setVariants((prev) =>
      prev.map((v) => ({ ...v, price: shortcutPrice }))
    )
    toast.success(`Applied price $${shortcutPrice} to all variants!`)
  }

  const applyInventoryToAll = () => {
    if (!shortcutInventory || isNaN(parseInt(shortcutInventory))) {
      toast.error("Please enter a valid inventory quantity.")
      return
    }
    setVariants((prev) =>
      prev.map((v) => ({ ...v, inventory_quantity: shortcutInventory }))
    )
    toast.success(`Applied quantity ${shortcutInventory} to all variants!`)
  }

  const autoGenerateSkus = () => {
    const cleanHandle = handle.trim() || title.toLowerCase().replace(/[^a-z0-9]/g, "-") || "PROD"
    setVariants((prev) =>
      prev.map((v, i) => ({
        ...v,
        sku: `${cleanHandle.toUpperCase()}-${Object.values(v.options).join("-").toUpperCase() || i + 1}`,
      }))
    )
    toast.success("Generated SKUs for all variants!")
  }

  // 4. Shipping & Logistics Attributes
  const [weight, setWeight] = useState(product?.weight?.toString() ?? "")
  const [length, setLength] = useState(product?.length?.toString() ?? "")
  const [height, setHeight] = useState(product?.height?.toString() ?? "")
  const [width, setWidth] = useState(product?.width?.toString() ?? "")
  const [material, setMaterial] = useState(product?.material ?? "")
  const [hsCode, setHsCode] = useState(product?.hs_code ?? "")
  const [midCode, setMidCode] = useState(product?.mid_code ?? "")
  const [originCountry, setOriginCountry] = useState(
    product?.origin_country ?? ""
  )

  const [error, setError] = useState<string | null>(null)

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: async () => {
      const base = {
        title: title.trim(),
        subtitle: text(subtitle),
        description: text(description),
        status,
        discountable,
        type_id: selectedTypeId || undefined,
        collection_id: selectedCollectionId || undefined,
        material: text(material),
        hs_code: text(hsCode),
        mid_code: text(midCode),
        origin_country: text(originCountry),
        weight: num(weight),
        length: num(length),
        height: num(height),
        width: num(width),
        sales_channels: selectedSalesChannelIds.length
          ? selectedSalesChannelIds.map((id) => ({ id }))
          : undefined,
        tags: selectedTags.length
          ? selectedTags.map((t) => ({ value: t }))
          : undefined,
      }

      if (isEdit) {
        return updateVendorProduct(product!.id, {
          ...base,
          categories: categoryIds.map((id) => ({ id })),
          ...(handle.trim() && handle.trim() !== product!.handle
            ? { handle: handle.trim() }
            : {}),
        })
      }

      // Build Create Payload with Options and Variants
      let payloadOptions: { title: string; values: string[] }[] = []
      let payloadVariants: any[] = []

      if (variantMode === "multi" && variants.length > 0) {
        payloadOptions = options
          .map((opt) => ({
            title: opt.title.trim(),
            values: opt.valuesString
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          }))
          .filter((opt) => opt.title && opt.values.length > 0)

        payloadVariants = variants.map((v) => ({
          title: v.title,
          sku: v.sku.trim() || undefined,
          barcode: v.barcode.trim() || undefined,
          manage_inventory: v.manage_inventory,
          inventory_quantity: v.manage_inventory
            ? parseInt(v.inventory_quantity, 10) || 0
            : undefined,
          prices: [
            {
              currency_code: "usd",
              amount: parseFloat(v.price) || 0,
            },
          ],
          options: v.options,
        }))
      } else {
        payloadOptions = [{ title: "Default", values: ["Default"] }]
        payloadVariants = [
          {
            title: "Default",
            options: { Default: "Default" },
            sku: singleSku.trim() || undefined,
            barcode: singleBarcode.trim() || undefined,
            manage_inventory: singleManageInventory,
            inventory_quantity: singleManageInventory
              ? parseInt(singleQuantity, 10) || 0
              : undefined,
            prices: Object.entries(prices)
              .filter(([, value]) => value.trim() !== "")
              .map(([currency_code, value]) => ({
                currency_code,
                amount: Number(value),
              })),
          },
        ]
      }

      return createVendorProduct({
        ...base,
        ...(handle.trim() ? { handle: handle.trim() } : {}),
        ...(categoryIds.length > 0
          ? { categories: categoryIds.map((id) => ({ id })) }
          : {}),
        options: payloadOptions,
        variants: payloadVariants,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
      if (isEdit) {
        queryClient.invalidateQueries({
          queryKey: ["vendor-product", product!.id],
        })
      }
    },
  })

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError("A product title is required.")
      return
    }

    if (!isEdit) {
      if (variantMode === "single") {
        const filled = Object.entries(prices).filter(
          ([, value]) => value.trim() !== ""
        )
        if (!filled.length) {
          setError("Enter a price in at least one currency.")
          return
        }
      } else {
        if (variants.length === 0) {
          setError("Please generate variant combinations for multi-variant products.")
          return
        }
      }
    }

    try {
      await save()
      toast.success(isEdit ? "Product updated." : "Product created successfully.")
      router.push(isEdit ? `/products/${product!.id}` : "/products")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save the product."
      )
    }
  }

  const addOptionField = () => {
    setOptions([...options, { title: "", valuesString: "" }])
  }

  const removeOptionField = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx))
  }

  const addTag = (val: string) => {
    const trimmed = val.trim()
    if (!trimmed || selectedTags.includes(trimmed)) return
    setSelectedTags([...selectedTags, trimmed])
    setNewTagInput("")
  }

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag))
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-y-6">
      <div className="flex items-center justify-between">
        <Heading level="h1">
          {isEdit ? product!.title : "Create product"}
        </Heading>
        <div className="flex items-center gap-x-2">
          <Link href={isEdit ? `/products/${product!.id}` : "/products"}>
            <Button variant="secondary" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" isLoading={isPending}>
            Save
          </Button>
        </div>
      </div>

      {/* 1. Category Classification */}
      <Card
        title="Product Category & Classification"
        description="Assign a standardized category tailored to your registered business vertical."
      >
        <TrustClawCategoryPicker
          selectedMedusaCategoryId={categoryIds[0] ?? null}
          selectedCategoryName={product?.categories?.[0]?.name ?? null}
          onSelectCategory={(categoryId) => {
            setCategoryIds(categoryId ? [categoryId] : [])
          }}
        />
      </Card>

      {/* 2. General */}
      <Card title="General">
        <Field id="title" label="Title">
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Winter Jacket"
          />
        </Field>

        <Field id="subtitle" label="Subtitle">
          <Input
            id="subtitle"
            value={subtitle ?? ""}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </Field>

        <Field
          id="handle"
          label="Handle"
          hint="The product's address in the storefront. Leave blank to generate one from the title."
        >
          <Input
            id="handle"
            value={handle ?? ""}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="winter-jacket"
          />
        </Field>

        <Field id="description" label="Description">
          <Textarea
            id="description"
            rows={5}
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field
          label="Status"
          hint="Only published products appear in the storefront."
        >
          <Select value={status} onValueChange={setStatus}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="draft">Draft</Select.Item>
              <Select.Item value="published">Published</Select.Item>
              <Select.Item value="proposed">Proposed</Select.Item>
              <Select.Item value="rejected">Rejected</Select.Item>
            </Select.Content>
          </Select>
        </Field>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <Label size="small" weight="plus">
              Discountable
            </Label>
            <Text size="small" className="text-ui-fg-subtle">
              Allow promotions and discounts to apply to this product.
            </Text>
          </div>
          <Switch checked={discountable} onCheckedChange={setDiscountable} />
        </div>
      </Card>

      {/* 3. Organize (Product Type, Collection, Tags, Sales Channels) */}
      <Card
        title="Organize"
        description="Categorize your product with collections, product types, tags, and sales channels."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Product Type */}
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Product Type
            </Label>
            <Select
              value={selectedTypeId || "none"}
              onValueChange={(val) => setSelectedTypeId(val === "none" ? "" : val)}
            >
              <Select.Trigger>
                <Select.Value placeholder="Select a product type..." />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="none">None</Select.Item>
                {productTypes.map((pt) => (
                  <Select.Item key={pt.id} value={pt.id}>
                    {pt.value}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {/* Collection */}
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Collection
            </Label>
            <Select
              value={selectedCollectionId || "none"}
              onValueChange={(val) => setSelectedCollectionId(val === "none" ? "" : val)}
            >
              <Select.Trigger>
                <Select.Value placeholder="Select a collection..." />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="none">None</Select.Item>
                {collections.map((c) => (
                  <Select.Item key={c.id} value={c.id}>
                    {c.title}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {/* Tags */}
          <div className="col-span-1 md:col-span-2 flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Tags
            </Label>
            <div className="flex flex-wrap items-center gap-1.5 min-h-[38px] p-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
              {selectedTags.map((tag) => (
                <Badge
                  key={tag}
                  size="small"
                  className="flex items-center gap-1 bg-ui-bg-base border border-ui-border-base"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-ui-fg-error"
                  >
                    ×
                  </button>
                </Badge>
              ))}
              <input
                type="text"
                placeholder="Type tag and press Enter..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addTag(newTagInput)
                  }
                }}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-ui-fg-muted min-w-[140px]"
              />
            </div>
            {existingTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                <Text size="xsmall" className="text-ui-fg-muted mr-1">
                  Suggested:
                </Text>
                {existingTags.slice(0, 6).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => addTag(t.value)}
                    className="text-[11px] text-ui-fg-interactive hover:underline mr-1.5"
                  >
                    +{t.value}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sales Channels */}
          <div className="col-span-1 md:col-span-2 flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Sales Channels
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {salesChannels.map((sc) => {
                const isChecked = selectedSalesChannelIds.includes(sc.id)
                return (
                  <div
                    key={sc.id}
                    onClick={() => {
                      if (isChecked) {
                        setSelectedSalesChannelIds(
                          selectedSalesChannelIds.filter((id) => id !== sc.id)
                        )
                      } else {
                        setSelectedSalesChannelIds([...selectedSalesChannelIds, sc.id])
                      }
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-ui-bg-base border-ui-border-interactive ring-1 ring-ui-border-interactive"
                        : "bg-ui-bg-subtle border-ui-border-base hover:border-ui-border-strong"
                    }`}
                  >
                    <Checkbox checked={isChecked} />
                    <div className="flex flex-col">
                      <Text size="small" weight="plus">
                        {sc.name}
                      </Text>
                      {sc.description && (
                        <Text size="xsmall" className="text-ui-fg-muted line-clamp-1">
                          {sc.description}
                        </Text>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Variants (View & Shortcuts) */}
      {!isEdit && (
        <Card
          title="Variants & Pricing"
          description="Create a single variant or define options (e.g. Size, Color) with automatic combination matrices and batch shortcuts."
          action={
            <div className="flex items-center gap-1 bg-ui-bg-subtle p-1 rounded-lg border border-ui-border-base">
              <Button
                size="small"
                variant={variantMode === "single" ? "primary" : "secondary"}
                onClick={() => setVariantMode("single")}
                type="button"
              >
                Single Variant
              </Button>
              <Button
                size="small"
                variant={variantMode === "multi" ? "primary" : "secondary"}
                onClick={() => setVariantMode("multi")}
                type="button"
              >
                Multi-Variant Matrix
              </Button>
            </div>
          }
        >
          {variantMode === "single" ? (
            <div className="space-y-4">
              <PriceFields prices={prices} onChange={setPrices} />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="single-sku" label="SKU (Stock Keeping Unit)">
                  <Input
                    id="single-sku"
                    placeholder="e.g. JACKET-01"
                    value={singleSku}
                    onChange={(e) => setSingleSku(e.target.value)}
                  />
                </Field>

                <Field id="single-barcode" label="Barcode / EAN">
                  <Input
                    id="single-barcode"
                    placeholder="e.g. 1234567890123"
                    value={singleBarcode}
                    onChange={(e) => setSingleBarcode(e.target.value)}
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-ui-border-base p-3">
                <div className="flex flex-col">
                  <Label size="small" weight="plus">
                    Track Inventory
                  </Label>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Manage stock counts on orders.
                  </Text>
                </div>
                <Switch
                  checked={singleManageInventory}
                  onCheckedChange={setSingleManageInventory}
                />
              </div>

              {singleManageInventory && (
                <Field id="single-quantity" label="Stock Quantity">
                  <Input
                    id="single-quantity"
                    type="number"
                    min="0"
                    value={singleQuantity}
                    onChange={(e) => setSingleQuantity(e.target.value)}
                  />
                </Field>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Options Definition */}
              <div className="space-y-3 bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
                <div className="flex items-center justify-between">
                  <Label size="small" weight="plus">
                    1. Product Options
                  </Label>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={addOptionField}
                    type="button"
                  >
                    <Plus className="size-4" />
                    Add Option
                  </Button>
                </div>

                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-6 items-end gap-3"
                  >
                    <div className="sm:col-span-2 flex flex-col gap-y-1">
                      <Label size="xsmall">Option Title</Label>
                      <Input
                        placeholder="e.g. Size, Color, Material"
                        value={opt.title}
                        onChange={(e) => {
                          const next = [...options]
                          next[idx].title = e.target.value
                          setOptions(next)
                        }}
                      />
                    </div>
                    <div className="sm:col-span-3 flex flex-col gap-y-1">
                      <Label size="xsmall">Values (comma-separated)</Label>
                      <Input
                        placeholder="e.g. Small, Medium, Large"
                        value={opt.valuesString}
                        onChange={(e) => {
                          const next = [...options]
                          next[idx].valuesString = e.target.value
                          setOptions(next)
                        }}
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <Button
                        variant="transparent"
                        size="small"
                        type="button"
                        onClick={() => removeOptionField(idx)}
                        disabled={options.length <= 1}
                        className="text-ui-fg-muted hover:text-ui-fg-error w-full"
                      >
                        <Trash className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  variant="primary"
                  size="small"
                  type="button"
                  onClick={handleGenerateVariants}
                  className="mt-2"
                >
                  Generate Variant Matrix
                </Button>
              </div>

              {/* Shortcuts Bar */}
              {variants.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-ui-bg-subtle p-3 rounded-lg border border-ui-border-base">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-ui-fg-interactive" />
                    <Text size="small" className="font-semibold text-ui-fg-base">
                      Shortcuts:
                    </Text>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Batch Price */}
                    <div className="flex items-center gap-1.5">
                      <Input
                        size="small"
                        type="number"
                        placeholder="Price ($)"
                        className="w-24"
                        value={shortcutPrice}
                        onChange={(e) => setShortcutPrice(e.target.value)}
                      />
                      <Button
                        size="small"
                        variant="secondary"
                        type="button"
                        onClick={applyPriceToAll}
                      >
                        Apply to all
                      </Button>
                    </div>

                    {/* Batch Inventory */}
                    <div className="flex items-center gap-1.5">
                      <Input
                        size="small"
                        type="number"
                        placeholder="Qty"
                        className="w-20"
                        value={shortcutInventory}
                        onChange={(e) => setShortcutInventory(e.target.value)}
                      />
                      <Button
                        size="small"
                        variant="secondary"
                        type="button"
                        onClick={applyInventoryToAll}
                      >
                        Apply to all
                      </Button>
                    </div>

                    {/* Auto SKU */}
                    <Button
                      size="small"
                      variant="secondary"
                      type="button"
                      onClick={autoGenerateSkus}
                    >
                      Auto-fill SKUs
                    </Button>
                  </div>
                </div>
              )}

              {/* Variants Matrix Table */}
              {variants.length > 0 && (
                <div className="border border-ui-border-base rounded-lg overflow-hidden">
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Variant</Table.HeaderCell>
                        <Table.HeaderCell className="w-36">SKU</Table.HeaderCell>
                        <Table.HeaderCell className="w-32">Barcode</Table.HeaderCell>
                        <Table.HeaderCell className="w-28">Price ($)</Table.HeaderCell>
                        <Table.HeaderCell className="w-24">Stock</Table.HeaderCell>
                        <Table.HeaderCell className="w-12"></Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {variants.map((v, idx) => (
                        <Table.Row key={v.id}>
                          <Table.Cell>
                            <Text size="small" weight="plus">
                              {v.title}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Input
                              size="small"
                              value={v.sku}
                              placeholder="SKU"
                              onChange={(e) => {
                                const next = [...variants]
                                next[idx].sku = e.target.value
                                setVariants(next)
                              }}
                            />
                          </Table.Cell>
                          <Table.Cell>
                            <Input
                              size="small"
                              value={v.barcode}
                              placeholder="Barcode"
                              onChange={(e) => {
                                const next = [...variants]
                                next[idx].barcode = e.target.value
                                setVariants(next)
                              }}
                            />
                          </Table.Cell>
                          <Table.Cell>
                            <Input
                              size="small"
                              type="number"
                              min="0"
                              step="0.01"
                              value={v.price}
                              onChange={(e) => {
                                const next = [...variants]
                                next[idx].price = e.target.value
                                setVariants(next)
                              }}
                            />
                          </Table.Cell>
                          <Table.Cell>
                            <Input
                              size="small"
                              type="number"
                              min="0"
                              value={v.inventory_quantity}
                              onChange={(e) => {
                                const next = [...variants]
                                next[idx].inventory_quantity = e.target.value
                                setVariants(next)
                              }}
                            />
                          </Table.Cell>
                          <Table.Cell>
                            <Button
                              variant="transparent"
                              size="small"
                              type="button"
                              onClick={() => {
                                setVariants(variants.filter((_, i) => i !== idx))
                              }}
                              className="text-ui-fg-muted hover:text-ui-fg-error"
                            >
                              <Trash className="size-4" />
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* 5. Attributes */}
      <Card
        title="Attributes"
        description="Used for shipping rates and customs paperwork. All optional."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField id="weight" label="Weight" value={weight} onChange={setWeight} />
          <NumberField id="length" label="Length" value={length} onChange={setLength} />
          <NumberField id="height" label="Height" value={height} onChange={setHeight} />
          <NumberField id="width" label="Width" value={width} onChange={setWidth} />
        </div>

        <Field id="material" label="Material">
          <Input
            id="material"
            value={material ?? ""}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="Cotton"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="hs_code" label="HS code">
            <Input
              id="hs_code"
              value={hsCode ?? ""}
              onChange={(e) => setHsCode(e.target.value)}
            />
          </Field>

          <Field id="mid_code" label="MID code">
            <Input
              id="mid_code"
              value={midCode ?? ""}
              onChange={(e) => setMidCode(e.target.value)}
            />
          </Field>
        </div>

        <Field
          id="origin_country"
          label="Country of origin"
          hint="Two-letter country code, such as GB or DE."
        >
          <Input
            id="origin_country"
            value={originCountry ?? ""}
            onChange={(e) => setOriginCountry(e.target.value)}
            placeholder="GB"
          />
        </Field>
      </Card>

      {product && (
        <Card
          title="Specifications & Master Attributes"
          description="Standardized product attributes imported from TrustClaw Master Catalog or custom specifications."
        >
          <TrustClawAttributesSection product={product} embedded />
        </Card>
      )}

      {error && (
        <Text size="small" className="text-ui-fg-error">
          {error}
        </Text>
      )}
    </form>
  )
}
