"use client"

import {
  createVendorProduct,
  createVendorProductTag,
  getTrustClawCategories,
  getTrustClawSegments,
  getVendorTaxonomy,
  listVendorCollections,
  listVendorProductTags,
  listVendorProductTypes,
  listVendorSalesChannels,
  listVendorShippingProfiles,
  uploadVendorImages,
  type TrustClawCategory,
} from "@lib/data/vendor-client"
import {
  Button,
  DropdownMenu,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  ProgressTabs,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { DotsSix, EllipsisHorizontal, Photo, Plus, Trash, XMark } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"

/**
 * Create product, laid out like the Medusa admin's own flow: a full-screen
 * window with three steps (Details, Organize, Variants), "Save as draft" at any
 * point, "Continue" between steps and "Publish" on the last one.
 */

type TabKey = "details" | "organize" | "variants"
const TABS: { key: TabKey; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "organize", label: "Organize" },
  { key: "variants", label: "Variants" },
]

const NONE = "__none__"
const DEFAULT_OPTION = "Default option"
const DEFAULT_OPTION_VALUE = "Default option value"

// Held locally until Save, like the admin: the file is only uploaded when the
// product is submitted, so the preview shows the moment it is picked.
type MediaItem = { id: string; file: File; name: string; size: number; preview: string }

type OptionDraft = { title: string; values: string }

type VariantRow = {
  key: string
  title: string
  options: Record<string, string>
  sku: string
  manage_inventory: boolean
  allow_backorder: boolean
  quantity: string
  prices: Record<string, string>
}

/* ----------------------------------------------------------- small parts */

const Field = ({
  label,
  optional,
  hint,
  children,
  htmlFor,
}: {
  label: string
  optional?: boolean
  hint?: string
  children: React.ReactNode
  htmlFor?: string
}) => (
  <div className="flex flex-col gap-y-2">
    <Label htmlFor={htmlFor} size="small" weight="plus">
      {label}
      {optional ? (
        <span className="text-ui-fg-muted font-normal"> (Optional)</span>
      ) : null}
    </Label>
    {children}
    {hint ? (
      <Text size="small" className="text-ui-fg-subtle">
        {hint}
      </Text>
    ) : null}
  </div>
)

/** Searchable multi-select, since the UI kit's Select is single-choice only. */
const MultiSelect = ({
  options,
  selected,
  onChange,
  placeholder,
  allowCreate,
}: {
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Lets the seller add a value that is not in the list (used for tags). */
  allowCreate?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? id
  const q = query.trim().toLowerCase()
  const matches = useMemo(
    () =>
      options
        .filter((o) => !q || o.label.toLowerCase().includes(q))
        .slice(0, 100),
    [options, q]
  )
  const canCreate =
    allowCreate &&
    q &&
    !options.some((o) => o.label.toLowerCase() === q) &&
    !selected.some((s) => s.toLowerCase() === q)

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])

  return (
    <div className="relative">
      <div
        className="shadow-buttons-neutral bg-ui-bg-field hover:bg-ui-bg-field-hover flex min-h-8 w-full cursor-text flex-wrap items-center gap-1 rounded-md px-2 py-1"
        onClick={() => setOpen(true)}
      >
        {selected.map((id) => (
          <span
            key={id}
            className="bg-ui-bg-base-hover txt-compact-xsmall flex items-center gap-x-1 rounded px-1.5 py-0.5"
          >
            {labelOf(id)}
            <button
              type="button"
              aria-label={"Remove " + labelOf(id)}
              onClick={(e) => {
                e.stopPropagation()
                toggle(id)
              }}
            >
              <XMark className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canCreate) {
              e.preventDefault()
              onChange([...selected, query.trim()])
              setQuery("")
            }
            if (e.key === "Escape") setOpen(false)
          }}
          placeholder={selected.length ? "" : placeholder}
          className="txt-compact-small min-w-24 flex-1 bg-transparent outline-none"
        />
      </div>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="bg-ui-bg-base shadow-elevation-flyout absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg p-1">
            {canCreate ? (
              <button
                type="button"
                className="hover:bg-ui-bg-base-hover txt-compact-small flex w-full items-center gap-x-2 rounded px-2 py-1.5 text-left"
                onClick={() => {
                  onChange([...selected, query.trim()])
                  setQuery("")
                }}
              >
                <Plus className="size-4" /> Add &quot;{query.trim()}&quot;
              </button>
            ) : null}
            {matches.length ? (
              matches.map((o) => {
                const active = selected.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    className="hover:bg-ui-bg-base-hover txt-compact-small flex w-full items-center justify-between rounded px-2 py-1.5 text-left"
                    onClick={() => toggle(o.id)}
                  >
                    <span>{o.label}</span>
                    {active ? <span className="text-ui-fg-interactive">✓</span> : null}
                  </button>
                )
              })
            ) : canCreate ? null : (
              <Text size="small" className="text-ui-fg-muted px-2 py-1.5">
                Nothing found.
              </Text>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

const Section = ({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) => (
  <section className="flex flex-col gap-y-4 border-t pt-8">
    <div className="flex flex-col gap-y-1">
      <Heading level="h2">{title}</Heading>
      {description ? (
        <Text size="small" className="text-ui-fg-subtle">
          {description}
        </Text>
      ) : null}
    </div>
    {children}
  </section>
)


/** One drop-down of the Segment -> L1 -> L2 -> L3 chain. */
const LevelSelect = ({
  label,
  options,
  value,
  onChange,
  isLoading,
  disabled,
}: {
  label: string
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  isLoading?: boolean
  disabled?: boolean
}) => (
  <Field label={label} optional>
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={isLoading || disabled}>
      <Select.Trigger>
        <Select.Value placeholder={isLoading ? "Loading..." : "Select"} />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value={NONE}>None</Select.Item>
        {options.map((o) => (
          <Select.Item key={o.id} value={o.id}>
            {o.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  </Field>
)

/** A level's categories, fetched only once its parent has been chosen. */
const useLevel = (segmentCode: string, parentId: string | null, enabled: boolean) =>
  useQuery({
    queryKey: ["tc-categories", segmentCode, parentId],
    queryFn: () => getTrustClawCategories({ segmentCode, parentId: parentId ?? "null", limit: 500 }),
    enabled: enabled && Boolean(segmentCode),
    staleTime: 10 * 60 * 1000,
  })

const cartesian = (options: { title: string; values: string[] }[]) => {
  let combos: Record<string, string>[] = [{}]
  for (const opt of options) {
    const next: Record<string, string>[] = []
    for (const combo of combos) {
      for (const value of opt.values) next.push({ ...combo, [opt.title]: value })
    }
    combos = next
  }
  return combos
}

const parseValues = (raw: string) =>
  [...new Set(raw.split(",").map((v) => v.trim()).filter(Boolean))]

/* ------------------------------------------------------------------ flow */

export const ProductCreateFlow = ({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabKey>("details")
  const [error, setError] = useState<string | null>(null)

  // Details
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [handle, setHandle] = useState("")
  const [description, setDescription] = useState("")
  const [images, setImages] = useState<MediaItem[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Tags created while saving, by value. A retry after a failed save reuses them
  // instead of trying to create the same tag twice.
  const createdTagIds = useRef<Record<string, string>>({})
  // Current previews, so they can be released when the window closes.
  const imagesRef = useRef<MediaItem[]>([])
  const [hasVariants, setHasVariants] = useState(false)
  const [optionDrafts, setOptionDrafts] = useState<OptionDraft[]>([
    { title: "", values: "" },
  ])

  // Organize
  const [discountable, setDiscountable] = useState(true)
  const [typeId, setTypeId] = useState(NONE)
  const [collectionId, setCollectionId] = useState(NONE)
  const [segmentCode, setSegmentCode] = useState("")
  // The chosen L1 / L2 / L3 categories, in order.
  const [chain, setChain] = useState<TrustClawCategory[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [shippingProfileId, setShippingProfileId] = useState(NONE)
  const [salesChannelIds, setSalesChannelIds] = useState<string[] | null>(null)

  // Variants
  const [rowEdits, setRowEdits] = useState<Record<string, Partial<VariantRow>>>({})

  const stale = 5 * 60 * 1000
  const { data: taxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
    staleTime: stale,
    enabled: open && tab === "variants",
  })
  const { data: typesData } = useQuery({
    queryKey: ["vendor-product-types"],
    queryFn: () => listVendorProductTypes({ limit: 100, offset: 0 }),
    staleTime: stale,
    enabled: open && tab !== "details",
  })
  const { data: collectionsData } = useQuery({
    queryKey: ["vendor-collections"],
    queryFn: () => listVendorCollections({ limit: 100, offset: 0 }),
    staleTime: stale,
    enabled: open && tab !== "details",
  })
  const { data: tagsData } = useQuery({
    queryKey: ["vendor-product-tags"],
    queryFn: () => listVendorProductTags({ limit: 100, offset: 0 }),
    staleTime: stale,
    enabled: open && tab !== "details",
  })
  const { data: channelsData } = useQuery({
    queryKey: ["vendor-sales-channels"],
    queryFn: () => listVendorSalesChannels({ limit: 100, offset: 0 }),
    staleTime: stale,
    enabled: open && tab !== "details",
  })
  const { data: profilesData } = useQuery({
    queryKey: ["vendor-shipping-profiles"],
    queryFn: () => listVendorShippingProfiles(),
    staleTime: stale,
    enabled: open && tab !== "details",
  })

  const { data: segments = [], isLoading: segmentsLoading } = useQuery({
    queryKey: ["tc-segments"],
    queryFn: getTrustClawSegments,
    staleTime: 10 * 60 * 1000,
    enabled: open && tab !== "details",
  })
  const level1 = useLevel(segmentCode, null, Boolean(segmentCode))
  const level2 = useLevel(segmentCode, chain[0]?.id ?? null, Boolean(chain[0]))
  const level3 = useLevel(segmentCode, chain[1]?.id ?? null, Boolean(chain[1]))
  const levelQueries = [level1, level2, level3]

  const pickSegment = (code: string) => {
    setSegmentCode(code)
    setChain([])
  }
  const pickLevel = (levelIndex: number, id: string) => {
    const options = levelQueries[levelIndex].data ?? []
    const picked = options.find((c) => c.id === id)
    // Choosing (or clearing) a level resets every level below it.
    setChain([...chain.slice(0, levelIndex), ...(picked ? [picked] : [])])
  }
  // The most specific category chosen is the one the product is filed under.
  const deepest = chain[chain.length - 1]
  const categoryIds = deepest?.medusa_id ? [deepest.medusa_id] : []

  const types = typesData?.product_types ?? []
  const collections = collectionsData?.collections ?? []
  const channels = channelsData?.sales_channels ?? []
  const profiles = profilesData?.shipping_profiles ?? []
  const currencies = taxonomy?.currencies ?? []
  const tagOptions = (tagsData?.product_tags ?? []).map((t) => ({ id: t.value, label: t.value }))
  const channelOptions = channels.map((c) => ({ id: c.id, label: c.name }))
  // Untouched means just the store's default channel, as in the admin.
  const selectedChannels =
    salesChannelIds ?? channels.filter((c) => c.is_default).map((c) => c.id)

  /* Variant rows follow the options: edits are kept per combination. */
  const activeOptions = useMemo(
    () =>
      hasVariants
        ? optionDrafts
            .map((o) => ({ title: o.title.trim(), values: parseValues(o.values) }))
            .filter((o) => o.title && o.values.length)
        : [],
    [hasVariants, optionDrafts]
  )

  const rows: VariantRow[] = useMemo(() => {
    const combos = activeOptions.length
      ? cartesian(activeOptions)
      : [{ [DEFAULT_OPTION]: DEFAULT_OPTION_VALUE }]
    return combos.map((options) => {
      const key = Object.entries(options).map(([k, v]) => k + "=" + v).join("|")
      const base: VariantRow = {
        key,
        title: activeOptions.length ? Object.values(options).join(" / ") : "Default variant",
        options,
        sku: "",
        manage_inventory: false,
        allow_backorder: false,
        quantity: "",
        prices: {},
      }
      return { ...base, ...rowEdits[key] }
    })
  }, [activeOptions, rowEdits])

  const editRow = (key: string, patch: Partial<VariantRow>) =>
    setRowEdits((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  /* -------------------------------------------------------------- saving */

  const create = useMutation({
    mutationFn: async (status: "draft" | "published") => {
      // The create API links tags by id. Existing tags are looked up by their
      // value; a tag typed in fresh is created first.
      const existingTags = tagsData?.product_tags ?? []
      const tagIds = await Promise.all(
        tags.map(async (value) => {
          const found = existingTags.find((t) => t.value === value)
          if (found) return found.id
          if (createdTagIds.current[value]) return createdTagIds.current[value]
          const created = await createVendorProductTag({ value })
          createdTagIds.current[value] = created.product_tag.id
          return created.product_tag.id
        })
      )

      // Upload the picked images now. Results come back in the order sent, so
      // the first one stays the thumbnail.
      const uploaded = images.length
        ? await uploadVendorImages(images.map((i) => i.file))
        : []

      return createVendorProduct({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
        ...(handle.trim() ? { handle: handle.trim() } : {}),
        status,
        discountable,
        type_id: typeId === NONE ? undefined : typeId,
        collection_id: collectionId === NONE ? undefined : collectionId,
        shipping_profile_id: shippingProfileId === NONE ? undefined : shippingProfileId,
        categories: categoryIds.length ? categoryIds.map((id) => ({ id })) : undefined,
        tags: tagIds.length ? tagIds.map((id) => ({ id })) : undefined,
        sales_channels: selectedChannels.length
          ? selectedChannels.map((id) => ({ id }))
          : undefined,
        ...(uploaded.length
          ? { images: uploaded.map((f) => ({ url: f.url })), thumbnail: uploaded[0].url }
          : {}),
        options: activeOptions.length
          ? activeOptions
          : [{ title: DEFAULT_OPTION, values: [DEFAULT_OPTION_VALUE] }],
        variants: rows.map((r) => ({
          title: r.title,
          options: r.options,
          sku: r.sku.trim() || undefined,
          manage_inventory: r.manage_inventory,
          allow_backorder: r.allow_backorder,
          // The create API's schema has no stock field; the route reads the
          // opening stock from the variant's metadata.
          ...(r.manage_inventory
            ? { metadata: { inventory_quantity: parseInt(r.quantity, 10) || 0 } }
            : {}),
          prices: Object.entries(r.prices)
            .filter(([, amount]) => amount.trim() !== "")
            .map(([currency_code, amount]) => ({ currency_code, amount: Number(amount) })),
        })),
      })
    },
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
      toast.success(status === "draft" ? "Product saved as draft." : "Product published.")
      onClose()
    },
    onError: (e: any) => setError(e?.message || "Could not save the product."),
  })

  const submit = (status: "draft" | "published") => {
    setError(null)
    if (!title.trim()) {
      setTab("details")
      setError("A product title is required.")
      return
    }
    if (hasVariants && !activeOptions.length) {
      setTab("details")
      setError("Add at least one option with values, such as Size: S, M, L.")
      return
    }
    if (status === "published" && rows.some((r) => !Object.values(r.prices).some((p) => p.trim() !== ""))) {
      setTab("variants")
      setError("Every variant needs a price in at least one currency before publishing.")
      return
    }
    create.mutate(status)
  }

  const onFiles = (picked: File[]) => {
    const files = picked.filter((f) => f.type.startsWith("image/"))
    if (files.length < picked.length) {
      toast.error("Only image files can be added.")
    }
    if (!files.length) return
    setImages((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: file.name + "-" + file.size + "-" + Math.random().toString(36).slice(2),
        file,
        name: file.name,
        size: file.size,
        preview: URL.createObjectURL(file),
      })),
    ])
  }

  useEffect(() => {
    imagesRef.current = images
  }, [images])
  useEffect(
    () => () => imagesRef.current.forEach((i) => URL.revokeObjectURL(i.preview)),
    []
  )

  const idx = TABS.findIndex((t) => t.key === tab)
  const last = idx === TABS.length - 1
  const status = (key: TabKey): "not-started" | "in-progress" | "completed" =>
    key === tab ? "in-progress" : TABS.findIndex((t) => t.key === key) < idx ? "completed" : "not-started"

  /* --------------------------------------------------------------- tabs */

  const detailsTab = (
    <div className="flex w-full max-w-[720px] flex-col gap-y-8 py-12">
      <Heading level="h1">Create product</Heading>
      <div className="flex flex-col gap-y-4">
        <Heading level="h2">General</Heading>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Title" htmlFor="pc-title">
            <Input id="pc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Winter jacket" />
          </Field>
          <Field label="Subtitle" optional htmlFor="pc-subtitle">
            <Input id="pc-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Warm and cosy" />
          </Field>
          <Field label="Handle" optional htmlFor="pc-handle">
            <div className="flex">
              <span className="border-ui-border-base bg-ui-bg-field txt-compact-small text-ui-fg-muted flex items-center rounded-l-md border border-r-0 px-3">
                /
              </span>
              <Input
                id="pc-handle"
                className="rounded-l-none"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="winter-jacket"
              />
            </div>
          </Field>
        </div>
        <Field label="Description" optional htmlFor="pc-description">
          <Textarea id="pc-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A warm and cosy jacket" />
        </Field>
      </div>

      <div className="flex flex-col gap-y-3">
        <Field label="Media" optional>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              // Copy before clearing: resetting the input empties its FileList.
              const picked = Array.from(e.target.files ?? [])
              e.target.value = ""
              onFiles(picked)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              onFiles(Array.from(e.dataTransfer.files))
            }}
            className="border-ui-border-strong bg-ui-bg-field hover:bg-ui-bg-field-hover flex flex-col items-center gap-y-1 rounded-lg border border-dashed px-6 py-10"
          >
            <span className="txt-compact-medium flex items-center gap-x-2">
              <Photo className="size-4" /> Upload images
            </span>
            <Text size="small" className="text-ui-fg-subtle">
              Drag and drop images here or click to upload.
            </Text>
          </button>
        </Field>
        {images.length ? (
          <ul className="flex flex-col gap-y-2">
            {images.map((img, i) => (
              <li
                key={img.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex === null || dragIndex === i) return
                  const next = [...images]
                  const [moved] = next.splice(dragIndex, 1)
                  next.splice(i, 0, moved)
                  setImages(next)
                  setDragIndex(null)
                }}
                className="bg-ui-bg-component shadow-elevation-card-rest flex items-center gap-x-3 rounded-lg px-3 py-2"
              >
                <DotsSix className="text-ui-fg-muted size-4 shrink-0 cursor-grab" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt=""
                  className="size-10 shrink-0 rounded border object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="txt-compact-small truncate">{img.name}</span>
                  <span className="txt-compact-xsmall text-ui-fg-subtle">
                    {(img.size / 1024).toFixed(2)} KB{i === 0 ? " · Thumbnail" : ""}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenu.Trigger asChild>
                    <IconButton type="button" size="small" variant="transparent" aria-label="Image actions">
                      <EllipsisHorizontal />
                    </IconButton>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content>
                    <DropdownMenu.Item
                      disabled={i === 0}
                      onClick={() => {
                        const next = [...images]
                        const [moved] = next.splice(i, 1)
                        setImages([moved, ...next])
                      }}
                    >
                      Set as thumbnail
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
                <IconButton
                  type="button"
                  size="small"
                  variant="transparent"
                  aria-label="Remove image"
                  onClick={() => {
                    URL.revokeObjectURL(img.preview)
                    setImages(images.filter((_, j) => j !== i))
                  }}
                >
                  <XMark />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-col gap-y-4">
        <div className="bg-ui-bg-component shadow-elevation-card-rest flex items-start gap-x-3 rounded-lg p-4">
          <Switch checked={hasVariants} onCheckedChange={setHasVariants} id="pc-has-variants" />
          <div className="flex flex-col">
            <Label htmlFor="pc-has-variants" size="small" weight="plus">
              Yes, this is a product with variants
            </Label>
            <Text size="small" className="text-ui-fg-subtle">
              When unchecked, we will create a default variant for you.
            </Text>
          </div>
        </div>
        {hasVariants ? (
          <div className="flex flex-col gap-y-3">
            <Heading level="h2">Product options</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Define the options for the product, e.g. color, size. Separate values with commas.
            </Text>
            {optionDrafts.map((o, i) => (
              <div key={i} className="flex items-end gap-x-2">
                <div className="w-1/3">
                  <Field label="Option title">
                    <Input
                      value={o.title}
                      placeholder="Size"
                      onChange={(e) =>
                        setOptionDrafts(optionDrafts.map((d, j) => (j === i ? { ...d, title: e.target.value } : d)))
                      }
                    />
                  </Field>
                </div>
                <div className="flex-1">
                  <Field label="Values">
                    <Input
                      value={o.values}
                      placeholder="S, M, L"
                      onChange={(e) =>
                        setOptionDrafts(optionDrafts.map((d, j) => (j === i ? { ...d, values: e.target.value } : d)))
                      }
                    />
                  </Field>
                </div>
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  aria-label="Remove option"
                  disabled={optionDrafts.length === 1}
                  onClick={() => setOptionDrafts(optionDrafts.filter((_, j) => j !== i))}
                >
                  <Trash />
                </Button>
              </div>
            ))}
            <div>
              <Button type="button" size="small" variant="secondary" onClick={() => setOptionDrafts([...optionDrafts, { title: "", values: "" }])}>
                <Plus /> Add option
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )

  const simpleSelect = (
    value: string,
    onChange: (v: string) => void,
    items: { id: string; label: string }[]
  ) => (
    <Select value={value} onValueChange={onChange}>
      <Select.Trigger>
        <Select.Value placeholder="None" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value={NONE}>None</Select.Item>
        {items.map((i) => (
          <Select.Item key={i.id} value={i.id}>
            {i.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  )

  const organizeTab = (
    <div className="flex w-full max-w-[720px] flex-col gap-y-8 py-12">
      <Heading level="h1">Organize</Heading>

      <Section
        title="Category"
        description="Pick a segment, then narrow it down. The product is listed under the last level you choose."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LevelSelect
            label="Segment"
            value={segmentCode}
            onChange={pickSegment}
            isLoading={segmentsLoading}
            options={segments.map((s) => ({ id: s.code, label: s.name }))}
          />
          <LevelSelect
            label="Category (L1)"
            value={chain[0]?.id ?? ""}
            onChange={(id) => pickLevel(0, id)}
            isLoading={Boolean(segmentCode) && level1.isLoading}
            disabled={!segmentCode}
            options={(level1.data ?? []).map((c) => ({ id: c.id, label: c.name }))}
          />
          {chain[0] && (level2.isLoading || (level2.data ?? []).length > 0) ? (
            <LevelSelect
              label="Sub-category (L2)"
              value={chain[1]?.id ?? ""}
              onChange={(id) => pickLevel(1, id)}
              isLoading={level2.isLoading}
              options={(level2.data ?? []).map((c) => ({ id: c.id, label: c.name }))}
            />
          ) : null}
          {chain[1] && (level3.isLoading || (level3.data ?? []).length > 0) ? (
            <LevelSelect
              label="Sub-category (L3)"
              value={chain[2]?.id ?? ""}
              onChange={(id) => pickLevel(2, id)}
              isLoading={level3.isLoading}
              options={(level3.data ?? []).map((c) => ({ id: c.id, label: c.name }))}
            />
          ) : null}
        </div>
        {chain.length ? (
          <Text size="small" className="text-ui-fg-subtle">
            {[segments.find((s) => s.code === segmentCode)?.name, ...chain.map((c) => c.name)]
              .filter(Boolean)
              .join("  ›  ")}
          </Text>
        ) : null}
        {deepest && !deepest.medusa_id ? (
          <Text size="small" className="text-ui-fg-error">
            This category has not been synced to the store yet, so it cannot be assigned. Pick a different one.
          </Text>
        ) : null}
      </Section>

      <Section title="Classification">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Type" optional>
            {simpleSelect(typeId, setTypeId, types.map((t) => ({ id: t.id, label: t.value })))}
          </Field>
          <Field label="Collection" optional>
            {simpleSelect(collectionId, setCollectionId, collections.map((c) => ({ id: c.id, label: c.title })))}
          </Field>
        </div>
        <Field label="Tags" optional>
          <MultiSelect options={tagOptions} selected={tags} onChange={setTags} placeholder="Search or add tags" allowCreate />
        </Field>
      </Section>

      <Section title="Sales and shipping">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Shipping profile" optional hint="Connect the product to a shipping profile.">
            {simpleSelect(shippingProfileId, setShippingProfileId, profiles.map((p) => ({ id: p.id, label: p.name })))}
          </Field>
        </div>
        <Field
          label="Sales channels"
          optional
          hint="This product will only be available in the default sales channel if left untouched."
        >
          <MultiSelect
            options={channelOptions}
            selected={selectedChannels}
            onChange={setSalesChannelIds}
            placeholder="Search sales channels"
          />
        </Field>
        <div className="bg-ui-bg-component shadow-elevation-card-rest flex items-start gap-x-3 rounded-lg p-4">
          <Switch checked={discountable} onCheckedChange={setDiscountable} id="pc-discountable" />
          <div className="flex flex-col">
            <Label htmlFor="pc-discountable" size="small" weight="plus">
              Discountable <span className="text-ui-fg-muted font-normal">(Optional)</span>
            </Label>
            <Text size="small" className="text-ui-fg-subtle">
              When unchecked, discounts will not be applied to this product.
            </Text>
          </div>
        </div>
      </Section>
    </div>
  )

  const cellInput = "txt-compact-small h-full w-full bg-transparent px-3 py-2 outline-none focus:bg-ui-bg-field-hover"
  const variantsTab = (
    <div className="flex h-full w-full flex-col">
      <div className="overflow-auto">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="txt-compact-small text-ui-fg-subtle border-b text-left">
              {activeOptions.length ? (
                activeOptions.map((o) => <th key={o.title} className="px-3 py-3 font-normal">{o.title}</th>)
              ) : (
                <th className="px-3 py-3 font-normal">Default option</th>
              )}
              <th className="border-l px-3 py-3 font-normal">Title</th>
              <th className="border-l px-3 py-3 font-normal">SKU</th>
              <th className="border-l px-3 py-3 font-normal">Managed inventory</th>
              <th className="border-l px-3 py-3 font-normal">Stock</th>
              <th className="border-l px-3 py-3 font-normal">Allow backorder</th>
              {currencies.map((c) => (
                <th key={c.code} className="border-l px-3 py-3 font-normal">Price {c.code.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b">
                {(activeOptions.length ? activeOptions.map((o) => r.options[o.title]) : [DEFAULT_OPTION_VALUE]).map((v, i) => (
                  <td key={i} className="txt-compact-small text-ui-fg-subtle px-3 py-2">{v}</td>
                ))}
                <td className="border-l">
                  <input className={cellInput} value={r.title} onChange={(e) => editRow(r.key, { title: e.target.value })} />
                </td>
                <td className="border-l">
                  <input className={cellInput} value={r.sku} onChange={(e) => editRow(r.key, { sku: e.target.value })} />
                </td>
                <td className="border-l px-3 text-center">
                  <input type="checkbox" checked={r.manage_inventory} onChange={(e) => editRow(r.key, { manage_inventory: e.target.checked })} />
                </td>
                <td className="border-l">
                  <input
                    type="number"
                    min="0"
                    disabled={!r.manage_inventory}
                    className={cellInput + " disabled:opacity-40"}
                    value={r.quantity}
                    onChange={(e) => editRow(r.key, { quantity: e.target.value })}
                  />
                </td>
                <td className="border-l px-3 text-center">
                  <input type="checkbox" checked={r.allow_backorder} onChange={(e) => editRow(r.key, { allow_backorder: e.target.checked })} />
                </td>
                {currencies.map((c) => (
                  <td key={c.code} className="border-l">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={cellInput}
                      value={r.prices[c.code] ?? ""}
                      onChange={(e) => editRow(r.key, { prices: { ...r.prices, [c.code]: e.target.value } })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!currencies.length ? (
        <Text size="small" className="text-ui-fg-muted p-4">
          No store currencies are available, so prices cannot be set yet.
        </Text>
      ) : null}
    </div>
  )

  return (
    <FocusModal open={open} onOpenChange={(next) => !next && onClose()}>
      <FocusModal.Content>
        <ProgressTabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex h-full flex-col overflow-hidden">
          <FocusModal.Header>
            <ProgressTabs.List className="-my-2 ml-2 flex w-full items-center justify-start">
              {TABS.map((t) => (
                <ProgressTabs.Trigger key={t.key} value={t.key} status={status(t.key)} className="w-full max-w-[200px]">
                  {t.label}
                </ProgressTabs.Trigger>
              ))}
            </ProgressTabs.List>
          </FocusModal.Header>
          <FocusModal.Body className="flex size-full flex-col items-center overflow-y-auto">
            <ProgressTabs.Content value="details" className="flex w-full justify-center px-6">
              {detailsTab}
            </ProgressTabs.Content>
            <ProgressTabs.Content value="organize" className="flex w-full justify-center px-6">
              {organizeTab}
            </ProgressTabs.Content>
            <ProgressTabs.Content value="variants" className="size-full">
              {variantsTab}
            </ProgressTabs.Content>
          </FocusModal.Body>
          <FocusModal.Footer>
            <div className="flex w-full items-center justify-between gap-x-2">
              <Text size="small" className="text-ui-fg-error">{error}</Text>
              <div className="flex items-center gap-x-2">
                <Button type="button" size="small" variant="secondary" disabled={create.isPending} onClick={onClose}>
                  Cancel
                </Button>
                <Button type="button" size="small" variant="secondary" disabled={create.isPending} isLoading={create.isPending && create.variables === "draft"} onClick={() => submit("draft")}>
                  Save as draft
                </Button>
                {last ? (
                  <Button type="button" size="small" disabled={create.isPending} isLoading={create.isPending && create.variables === "published"} onClick={() => submit("published")}>
                    Publish
                  </Button>
                ) : (
                  <Button type="button" size="small" disabled={create.isPending} onClick={() => setTab(TABS[idx + 1].key)}>
                    Continue
                  </Button>
                )}
              </div>
            </div>
          </FocusModal.Footer>
        </ProgressTabs>
      </FocusModal.Content>
    </FocusModal>
  )
}
