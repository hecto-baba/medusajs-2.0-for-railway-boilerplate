"use client"

import {
  createVendorVariant,
  deleteVendorVariant,
  updateVendorVariant,
  type VendorProduct,
  type VendorVariant,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Drawer,
  Input,
  Label,
  Switch,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Section } from "./section"
import {
  InventoryFields,
  PriceFields,
  VariantImageFields,
} from "./variant-drawer"

type DraftVariant = {
  title: string
  sku: string
  prices: Record<string, string>
  manageInventory: boolean
  options: Record<string, string>
}

const emptyDraft = (): DraftVariant => ({
  title: "",
  sku: "",
  prices: {},
  manageInventory: false,
  options: {},
})

/** Every price the variant has, as a currency-keyed map of strings. */
const pricesOf = (variant: VendorVariant): Record<string, string> =>
  Object.fromEntries(
    (variant.prices ?? []).map((price) => [
      price.currency_code,
      String(price.amount),
    ])
  )

/** Short summary for the table cell: "10 EUR, 12 USD". */
const priceSummary = (variant: VendorVariant) =>
  (variant.prices ?? [])
    .map((price) => price.amount + " " + price.currency_code.toUpperCase())
    .join(", ")

/**
 * Options are fixed once a variant exists: changing which value it maps to can
 * collide with another variant, and resolving that collision is the batch
 * endpoint's job rather than this drawer's. Shown read-only so the seller can
 * still see what they are editing.
 */
const VariantOptionsHint = ({ variant }: { variant: VendorVariant }) => {
  const values = variant.options ?? []

  if (!values.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small" weight="plus">
        Options
      </Label>
      <div className="flex flex-wrap gap-1">
        {values.map((value) => (
          <Badge key={value.id} size="small">
            {value.value}
          </Badge>
        ))}
      </div>
      <Text size="xsmall" className="text-ui-fg-muted">
        Delete and recreate the variant to change these.
      </Text>
    </div>
  )
}

/**
 * The variant table and its create/edit drawer.
 *
 * Prices are edited per variant in a form field rather than in the admin's
 * spreadsheet grid. That grid is thousands of lines of keyboard navigation and
 * copy-paste handling; this covers the same ground - a price per variant, per
 * currency - without the machinery.
 */
export const VariantsSection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VendorVariant | null>(null)
  const [draft, setDraft] = useState<DraftVariant>(emptyDraft())

  const variants = product.variants ?? []
  const options = product.options ?? []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["vendor-product", product.id] })
    queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
  }

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title: draft.title.trim(),
        sku: draft.sku.trim() || undefined,
        manage_inventory: draft.manageInventory,
        // Only currencies the seller actually filled in are sent; a blank
        // field means "not sold in this currency", not "free".
        prices: Object.entries(draft.prices)
          .filter(([, value]) => value.trim() !== "")
          .map(([currency_code, value]) => ({
            currency_code,
            amount: Number(value),
          })),
      }

      // Options are only sent on create - see VariantOptionsHint.
      if (!editing) {
        body.options = draft.options
      }

      return editing
        ? updateVendorVariant(product.id, editing.id, body)
        : createVendorVariant(product.id, body)
    },
    onSuccess: refresh,
  })

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => deleteVendorVariant(product.id, id),
    onSuccess: refresh,
  })

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyDraft())
    setOpen(true)
  }

  const openEdit = (variant: VendorVariant) => {
    setEditing(variant)
    setDraft({
      title: variant.title ?? "",
      sku: variant.sku ?? "",
      prices: pricesOf(variant),
      manageInventory: Boolean(variant.manage_inventory),
      options: {},
    })
    setOpen(true)
  }

  const onSave = async () => {
    if (!draft.title.trim()) {
      toast.error("Give the variant a title.")
      return
    }

    const filled = Object.entries(draft.prices).filter(
      ([, value]) => value.trim() !== ""
    )

    // A variant with no price in any currency cannot be bought anywhere.
    if (!filled.length) {
      toast.error("Enter a price in at least one currency.")
      return
    }

    const bad = filled.find(
      ([, value]) => Number.isNaN(Number(value)) || Number(value) < 0
    )

    if (bad) {
      toast.error("Prices must be zero or more.")
      return
    }

    // A variant that does not name a value for every option cannot be matched
    // to a shopper's selection, so the backend rejects it. Caught here to give
    // a clearer message than the API's.
    if (!editing) {
      const missing = options.filter((option) => !draft.options[option.title])

      if (missing.length) {
        toast.error(
          "Choose a value for " + missing.map((o) => o.title).join(", ") + "."
        )
        return
      }
    }

    try {
      await save()
      toast.success(editing ? "Variant updated." : "Variant added.")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the variant."
      )
    }
  }

  const onDelete = async (variant: VendorVariant) => {
    const confirmed = await prompt({
      title: "Delete variant",
      description:
        "Delete " +
        (variant.title ?? "this variant") +
        "? This cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (!confirmed) {
      return
    }

    try {
      await remove(variant.id)
      toast.success("Variant deleted.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the variant."
      )
    }
  }

  return (
    <Section
      title="Variants"
      actions={
        <Button size="small" variant="secondary" onClick={openCreate}>
          Create
        </Button>
      }
    >
      {variants.length ? (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Title</Table.HeaderCell>
              <Table.HeaderCell>SKU</Table.HeaderCell>
              <Table.HeaderCell>Options</Table.HeaderCell>
              <Table.HeaderCell>Price</Table.HeaderCell>
              <Table.HeaderCell>Inventory</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {variants.map((variant) => (
              <Table.Row key={variant.id}>
                <Table.Cell>{variant.title ?? "-"}</Table.Cell>
                <Table.Cell>
                  {variant.sku ?? <span className="text-ui-fg-muted">-</span>}
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-wrap gap-1">
                    {(variant.options ?? []).map((value) => (
                      <Badge key={value.id} size="small">
                        {value.value}
                      </Badge>
                    ))}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {priceSummary(variant) || (
                    <span className="text-ui-fg-muted">-</span>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {variant.manage_inventory ? "Managed" : "Not managed"}
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-x-3">
                    <button
                      type="button"
                      onClick={() => openEdit(variant)}
                      className="text-ui-fg-subtle hover:text-ui-fg-base txt-compact-small"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(variant)}
                      className="text-ui-fg-muted hover:text-ui-fg-base txt-compact-small"
                    >
                      Delete
                    </button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-muted">
            No variants yet. A product needs at least one to be purchasable.
          </Text>
        </div>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {editing ? "Edit variant" : "Create variant"}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="variant-title">
                Title
              </Label>
              <Input
                id="variant-title"
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </div>

            {!editing &&
              options.map((option) => (
                <div key={option.id} className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    {option.title}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {(option.values ?? []).map((value) => {
                      const selected =
                        draft.options[option.title] === value.value

                      return (
                        <button
                          key={value.id}
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              options: {
                                ...draft.options,
                                [option.title]: value.value,
                              },
                            })
                          }
                          className={
                            "txt-compact-small rounded-md border px-2 py-1 " +
                            (selected
                              ? "border-ui-border-interactive bg-ui-bg-base text-ui-fg-base"
                              : "border-ui-border-base text-ui-fg-subtle")
                          }
                        >
                          {value.value}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

            {editing ? <VariantOptionsHint variant={editing} /> : null}

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="variant-sku">
                SKU
              </Label>
              <Input
                id="variant-sku"
                value={draft.sku}
                onChange={(event) =>
                  setDraft({ ...draft, sku: event.target.value })
                }
              />
            </div>

            <PriceFields
              prices={draft.prices}
              onChange={(prices) => setDraft({ ...draft, prices })}
            />

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label size="small" weight="plus">
                  Manage inventory
                </Label>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Track stock levels for this variant.
                </Text>
              </div>
              <Switch
                checked={draft.manageInventory}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, manageInventory: checked })
                }
              />
            </div>
            {editing ? (
              <>
                <InventoryFields product={product} variant={editing} />
                <VariantImageFields product={product} variant={editing} />
              </>
            ) : null}
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
