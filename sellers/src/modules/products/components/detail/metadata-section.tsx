"use client"

import {
  updateVendorMetadata,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Drawer,
  IconButton,
  Input,
  Text,
  toast,
} from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Section } from "./section"

type Pair = { key: string; value: string }

const toPairs = (metadata: Record<string, unknown> | null | undefined): Pair[] =>
  Object.entries(metadata ?? {}).map(([key, value]) => ({
    key,
    // Objects and arrays are shown as JSON so they survive a round trip
    // through the editor rather than becoming "[object Object]".
    value:
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : String(value ?? ""),
  }))

/**
 * Free-form key/value data on the product.
 *
 * Values are stored as strings. The admin's editor allows typed values, but a
 * seller-facing editor that silently turns "1" into a number - and then
 * changes how the storefront compares it - is worse than one that is
 * predictable.
 */
export const MetadataSection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [pairs, setPairs] = useState<Pair[]>([])

  const current = toPairs(product.metadata)

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: (metadata: Record<string, unknown>) =>
      updateVendorMetadata(product.id, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-product", product.id] })
    },
  })

  const openDrawer = () => {
    setPairs(current.length ? current : [{ key: "", value: "" }])
    setOpen(true)
  }

  const onSave = async () => {
    const filled = pairs.filter((pair) => pair.key.trim())

    const duplicate = filled.find(
      (pair, index) =>
        filled.findIndex((other) => other.key.trim() === pair.key.trim()) !==
        index
    )

    // Two rows with the same key would silently collapse into one on save,
    // losing whichever the seller typed first.
    if (duplicate) {
      toast.error(`"${duplicate.key.trim()}" is used more than once.`)
      return
    }

    try {
      await save(
        Object.fromEntries(filled.map((pair) => [pair.key.trim(), pair.value]))
      )
      toast.success("Metadata saved.")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the metadata."
      )
    }
  }

  return (
    <Section
      title="Metadata"
      actions={
        <>
          <Badge size="small">
            {current.length} {current.length === 1 ? "key" : "keys"}
          </Badge>
          <Button size="small" variant="secondary" onClick={openDrawer}>
            Edit
          </Button>
        </>
      }
    >
      <div className="px-6 py-4">
        {current.length ? (
          <div className="flex flex-col gap-y-2">
            {current.map((pair) => (
              <div key={pair.key} className="grid grid-cols-2 gap-x-4">
                <Text size="small" weight="plus">
                  {pair.key}
                </Text>
                <Text size="small" className="text-ui-fg-subtle break-all">
                  {pair.value}
                </Text>
              </div>
            ))}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-muted">
            No metadata set.
          </Text>
        )}
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Edit metadata</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-3 overflow-y-auto">
            {pairs.map((pair, index) => (
              <div key={index} className="flex items-center gap-x-2">
                <Input
                  placeholder="Key"
                  value={pair.key}
                  onChange={(event) =>
                    setPairs(
                      pairs.map((entry, i) =>
                        i === index ? { ...entry, key: event.target.value } : entry
                      )
                    )
                  }
                />
                <Input
                  placeholder="Value"
                  value={pair.value}
                  onChange={(event) =>
                    setPairs(
                      pairs.map((entry, i) =>
                        i === index
                          ? { ...entry, value: event.target.value }
                          : entry
                      )
                    )
                  }
                />
                <IconButton
                  size="small"
                  variant="transparent"
                  onClick={() =>
                    setPairs(pairs.filter((_, i) => i !== index))
                  }
                >
                  <Trash />
                </IconButton>
              </div>
            ))}
            <Button
              size="small"
              variant="secondary"
              onClick={() => setPairs([...pairs, { key: "", value: "" }])}
            >
              Add row
            </Button>
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button size="small" onClick={onSave} isLoading={isPending}>
              Save
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Section>
  )
}

/**
 * The raw product record, as the admin's JSON card shows it.
 *
 * Read-only: it is a debugging aid for seeing exactly what the API returned,
 * not another way to edit the product.
 */
export const JsonSection = ({ product }: { product: VendorProduct }) => {
  const [open, setOpen] = useState(false)
  const keys = Object.keys(product).length

  return (
    <Section
      title="JSON"
      actions={
        <>
          <Badge size="small">
            {keys} {keys === 1 ? "key" : "keys"}
          </Badge>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setOpen(!open)}
          >
            {open ? "Hide" : "Show"}
          </Button>
        </>
      }
    >
      {open ? (
        <div className="px-6 py-4">
          <pre className="bg-ui-bg-subtle text-ui-fg-subtle max-h-96 overflow-auto rounded-lg p-4 text-xs">
            {JSON.stringify(product, null, 2)}
          </pre>
        </div>
      ) : null}
    </Section>
  )
}
