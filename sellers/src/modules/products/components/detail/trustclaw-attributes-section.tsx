"use client"

import {
  updateVendorMetadata,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  IconButton,
  Input,
  Text,
  toast,
} from "@medusajs/ui"
import {
  ChevronDownMini,
  ChevronUpMini,
  MagnifyingGlass,
  PencilSquare,
  Plus,
  SquareTwoStack,
  Trash,
} from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import {
  extractProductAttributes,
  formatAttributeKey,
  formatAttributeValue,
} from "../../utils/attributes"

type TrustClawAttributesSectionProps = {
  product: VendorProduct
  /**
   * If true, renders without container card wrapper (for embedding inside another card/form)
   */
  embedded?: boolean
}

type AttributePair = {
  key: string
  value: string
}

/**
 * Renders individual attribute values with rich badge/formatting support.
 */
const ValueRenderer = ({ value }: { value: unknown }) => {
  const [expanded, setExpanded] = useState(false)
  const strVal = formatAttributeValue(value)

  if (value === null || value === undefined || strVal === "") {
    return <span className="text-ui-fg-muted">-</span>
  }

  // Boolean or Yes/No badges
  const lower = strVal.toLowerCase().trim()
  if (lower === "yes" || lower === "true") {
    return (
      <Badge size="small" color="green" className="font-medium">
        Yes
      </Badge>
    )
  }
  if (lower === "no" || lower === "false") {
    return (
      <Badge size="small" color="grey" className="font-medium">
        No
      </Badge>
    )
  }

  // Dietary tags
  if (lower === "veg" || lower === "vegetarian") {
    return (
      <Badge size="small" color="green" className="font-medium">
        Veg
      </Badge>
    )
  }
  if (lower === "non-veg" || lower === "non veg" || lower === "non-vegetarian") {
    return (
      <Badge size="small" color="red" className="font-medium">
        Non-Veg
      </Badge>
    )
  }

  // Long text handling (e.g. disclaimer, seller address, storage instructions)
  const isLong = strVal.length > 75
  if (isLong) {
    return (
      <div className="flex flex-col gap-y-1">
        <Text size="small" className="text-ui-fg-subtle break-words leading-relaxed">
          {expanded ? strVal : `${strVal.slice(0, 75)}…`}
        </Text>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover text-[11px] font-medium self-start focus:outline-none"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      </div>
    )
  }

  return (
    <Text size="small" className="text-ui-fg-subtle break-words">
      {strVal}
    </Text>
  )
}

/**
 * Renders a clean, structured tabular data table of imported TrustClaw product attributes
 * positioned directly below the standard Attributes table in the seller panel.
 */
export const TrustClawAttributesSection = ({
  product,
  embedded = false,
}: TrustClawAttributesSectionProps) => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [openDrawer, setOpenDrawer] = useState(false)
  const [editPairs, setEditPairs] = useState<AttributePair[]>([])

  const rawAttributes = useMemo(
    () => extractProductAttributes(product),
    [product]
  )

  const entries = useMemo(() => {
    if (!rawAttributes) return []
    return Object.entries(rawAttributes).map(([key, val]) => ({
      rawKey: key,
      label: formatAttributeKey(key),
      value: val,
      stringValue: formatAttributeValue(val),
    }))
  }, [rawAttributes])

  // Filtered by search query
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.rawKey.toLowerCase().includes(q) ||
        item.stringValue.toLowerCase().includes(q)
    )
  }, [entries, search])

  // Limit initially to 7 items if list is long and search is not active
  const displayedEntries = useMemo(() => {
    if (showAll || search.trim() !== "") {
      return filteredEntries
    }
    return filteredEntries.slice(0, 7)
  }, [filteredEntries, showAll, search])

  const hasTrustClawBadge = Boolean(
    product.metadata?.is_master_clone ||
      product.metadata?.trustclaw_product_id ||
      product.metadata?.trustclaw_segment_code
  )

  // Copy JSON handler
  const handleCopyJson = async () => {
    if (!rawAttributes) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(rawAttributes, null, 2))
      toast.success("Copied specifications JSON to clipboard.")
    } catch {
      toast.error("Failed to copy to clipboard.")
    }
  }

  // Mutation for saving edited attributes
  const { mutateAsync: saveAttributes, isPending } = useMutation({
    mutationFn: (updatedRecord: Record<string, unknown>) => {
      const existingMeta = (product.metadata as Record<string, unknown>) || {}
      return updateVendorMetadata(product.id, {
        ...existingMeta,
        attributes: updatedRecord,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["vendor-product", product.id],
      })
      toast.success("Specifications updated.")
      setOpenDrawer(false)
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to update specifications."
      )
    },
  })

  // Open edit drawer with current pairs
  const handleOpenEdit = () => {
    if (entries.length > 0) {
      setEditPairs(
        entries.map((e) => ({
          key: e.rawKey,
          value: e.stringValue,
        }))
      )
    } else {
      setEditPairs([{ key: "", value: "" }])
    }
    setOpenDrawer(true)
  }

  const handleSaveEdit = async () => {
    const validPairs = editPairs.filter((p) => p.key.trim() !== "")
    const duplicate = validPairs.find(
      (pair, idx) =>
        validPairs.findIndex(
          (other) => other.key.trim().toLowerCase() === pair.key.trim().toLowerCase()
        ) !== idx
    )

    if (duplicate) {
      toast.error(`Attribute "${duplicate.key.trim()}" is duplicated.`)
      return
    }

    const newRecord: Record<string, unknown> = {}
    for (const pair of validPairs) {
      const key = pair.key.trim()
      const val = pair.value.trim()
      if (val.toLowerCase() === "true") newRecord[key] = true
      else if (val.toLowerCase() === "false") newRecord[key] = false
      else if (!isNaN(Number(val)) && val !== "") newRecord[key] = Number(val)
      else newRecord[key] = val
    }

    await saveAttributes(newRecord)
  }

  const content = (
    <div>
      {/* Header controls & Quick Search if many items */}
      {entries.length > 4 && showSearch && (
        <div className="bg-ui-bg-subtle/60 border-b border-ui-border-base px-6 py-2.5">
          <div className="relative flex items-center">
            <MagnifyingGlass className="text-ui-fg-muted absolute left-2.5 h-4 w-4" />
            <Input
              size="small"
              placeholder="Search specifications by name or value…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Tabular Rows */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-y-2 px-6 py-8 text-center">
          <Text size="small" className="text-ui-fg-muted">
            No specifications or catalog attributes recorded for this product.
          </Text>
          <Button size="small" variant="secondary" onClick={handleOpenEdit}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Specification
          </Button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="px-6 py-6 text-center">
          <Text size="small" className="text-ui-fg-muted">
            No specifications matching &ldquo;{search}&rdquo;
          </Text>
        </div>
      ) : (
        <div className="divide-ui-border-base divide-y">
          {displayedEntries.map((item) => (
            <div
              key={item.rawKey}
              className="hover:bg-ui-bg-subtle-hover grid grid-cols-2 items-start gap-x-4 px-6 py-3.5 transition-colors"
            >
              <div className="flex flex-col">
                <Text size="small" weight="plus" className="text-ui-fg-base">
                  {item.label}
                </Text>
                {item.rawKey !== item.label && (
                  <span className="text-ui-fg-muted font-mono text-[10px]">
                    {item.rawKey}
                  </span>
                )}
              </div>
              <div>
                <ValueRenderer value={item.value} />
              </div>
            </div>
          ))}

          {/* Expand / Collapse toggle */}
          {filteredEntries.length > 7 && search.trim() === "" && (
            <div className="bg-ui-bg-subtle/30 px-6 py-2.5 text-center">
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover inline-flex items-center gap-x-1 text-xs font-medium focus:outline-none"
              >
                {showAll ? (
                  <>
                    <ChevronUpMini className="h-4 w-4" />
                    Show fewer specifications
                  </>
                ) : (
                  <>
                    <ChevronDownMini className="h-4 w-4" />
                    Show all {filteredEntries.length} specifications
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit Drawer */}
      <Drawer open={openDrawer} onOpenChange={setOpenDrawer}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Edit Specifications</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-3 overflow-y-auto">
            <Text size="small" className="text-ui-fg-subtle mb-1">
              Add or modify standardized specifications and catalog attributes for this product.
            </Text>

            {editPairs.map((pair, index) => (
              <div key={index} className="flex items-center gap-x-2">
                <Input
                  placeholder="Attribute name (e.g. brand, organic)"
                  value={pair.key}
                  onChange={(e) =>
                    setEditPairs(
                      editPairs.map((entry, i) =>
                        i === index ? { ...entry, key: e.target.value } : entry
                      )
                    )
                  }
                  className="w-1/2"
                />
                <Input
                  placeholder="Value (e.g. Whole, 100g, Yes)"
                  value={pair.value}
                  onChange={(e) =>
                    setEditPairs(
                      editPairs.map((entry, i) =>
                        i === index ? { ...entry, value: e.target.value } : entry
                      )
                    )
                  }
                  className="w-1/2"
                />
                <IconButton
                  size="small"
                  variant="transparent"
                  onClick={() =>
                    setEditPairs(editPairs.filter((_, i) => i !== index))
                  }
                  title="Remove attribute"
                >
                  <Trash />
                </IconButton>
              </div>
            ))}

            <Button
              size="small"
              variant="secondary"
              className="mt-1 self-start"
              onClick={() => setEditPairs([...editPairs, { key: "", value: "" }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Row
            </Button>
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setOpenDrawer(false)}
            >
              Cancel
            </Button>
            <Button size="small" onClick={handleSaveEdit} isLoading={isPending}>
              Save Specifications
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )

  if (embedded) {
    return content
  }

  return (
    <Container className="divide-ui-border-base divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading level="h2">Specifications</Heading>
          {hasTrustClawBadge && (
            <Badge size="small" color="purple" rounded="full">
              TrustClaw
            </Badge>
          )}
          {entries.length > 0 && (
            <Badge size="small">
              {entries.length} {entries.length === 1 ? "spec" : "specs"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-x-1.5">
          {entries.length > 4 && (
            <IconButton
              size="small"
              variant="transparent"
              onClick={() => {
                setShowSearch(!showSearch)
                if (showSearch) setSearch("")
              }}
              title="Search specifications"
            >
              <MagnifyingGlass />
            </IconButton>
          )}
          {entries.length > 0 && (
            <IconButton
              size="small"
              variant="transparent"
              onClick={handleCopyJson}
              title="Copy specifications as JSON"
            >
              <SquareTwoStack />
            </IconButton>
          )}
          <Button size="small" variant="secondary" onClick={handleOpenEdit}>
            <PencilSquare className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </div>
      {content}
    </Container>
  )
}
