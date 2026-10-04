"use client"

import {
  getVendorTaxonomy,
  updateVendorProduct,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Drawer,
  Label,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Row, Section } from "./section"

// Select has no empty-string option, so a sentinel stands in for "none".
const NONE = "__none__"

/**
 * Organisation: collection, type, categories and tags.
 *
 * The lists come from the store's shared taxonomy rather than anything the
 * vendor owns - these are the platform's shelving, and a category only one
 * vendor could see would be invisible to the storefront's navigation.
 *
 * Categories and tags are multi-select, which the UI kit's Select does not do,
 * so they are toggled as chips.
 */
export const OrganizeSection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const [collectionId, setCollectionId] = useState(NONE)
  const [typeId, setTypeId] = useState(NONE)
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [tagIds, setTagIds] = useState<string[]>([])

  // Only fetched once the drawer opens: the read view renders from the
  // product itself, so the whole taxonomy is not worth loading on every page.
  const { data: taxonomy, isLoading } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: () =>
      updateVendorProduct(product.id, {
        collection_id: collectionId === NONE ? null : collectionId,
        type_id: typeId === NONE ? null : typeId,
        // Both are replace-semantics: the full set is sent, and an empty
        // array clears them.
        categories: categoryIds.map((id) => ({ id })),
        tags: tagIds.map((id) => ({ id })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-product", product.id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
    },
  })

  const openDrawer = () => {
    setCollectionId(product.collection?.id ?? NONE)
    setTypeId(product.type?.id ?? NONE)
    setCategoryIds((product.categories ?? []).map((category) => category.id))
    setTagIds((product.tags ?? []).map((tag) => tag.id))
    setOpen(true)
  }

  const toggle = (
    id: string,
    selected: string[],
    setSelected: (value: string[]) => void
  ) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((entry) => entry !== id)
        : [...selected, id]
    )

  const onSave = async () => {
    try {
      await save()
      toast.success("Organisation updated.")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the changes."
      )
    }
  }

  const Chips = ({
    items,
    selected,
    setSelected,
    empty,
  }: {
    items: { id: string; label: string }[]
    selected: string[]
    setSelected: (value: string[]) => void
    empty: string
  }) => {
    if (!items.length) {
      return (
        <Text size="xsmall" className="text-ui-fg-muted">
          {empty}
        </Text>
      )
    }

    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = selected.includes(item.id)

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id, selected, setSelected)}
              className={
                "txt-compact-small rounded-md border px-2 py-1 " +
                (active
                  ? "border-ui-border-interactive bg-ui-bg-base text-ui-fg-base"
                  : "border-ui-border-base text-ui-fg-subtle")
              }
            >
              {item.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <Section
      title="Organize"
      actions={
        <Button size="small" variant="secondary" onClick={openDrawer}>
          Edit
        </Button>
      }
    >
      <Row label="Tags">
        {product.tags?.length
          ? product.tags.map((tag) => (
              <Badge key={tag.id} size="small" className="mr-1">
                {tag.value}
              </Badge>
            ))
          : null}
      </Row>
      <Row label="Type">{product.type?.value}</Row>
      <Row label="Collection">{product.collection?.title}</Row>
      <Row label="Categories">
        {product.categories?.length
          ? product.categories.map((category) => (
              <Badge key={category.id} size="small" className="mr-1">
                {category.name}
              </Badge>
            ))
          : null}
      </Row>

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Edit organisation</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
            {isLoading ? (
              <Text size="small" className="text-ui-fg-muted">
                Loading…
              </Text>
            ) : (
              <>
                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Collection
                  </Label>
                  <Select value={collectionId} onValueChange={setCollectionId}>
                    <Select.Trigger>
                      <Select.Value placeholder="None" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value={NONE}>None</Select.Item>
                      {(taxonomy?.collections ?? []).map((collection) => (
                        <Select.Item key={collection.id} value={collection.id}>
                          {collection.title}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                  {!taxonomy?.collections.length ? (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      The store has no collections yet.
                    </Text>
                  ) : null}
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Type
                  </Label>
                  <Select value={typeId} onValueChange={setTypeId}>
                    <Select.Trigger>
                      <Select.Value placeholder="None" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value={NONE}>None</Select.Item>
                      {(taxonomy?.types ?? []).map((type) => (
                        <Select.Item key={type.id} value={type.id}>
                          {type.value}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                  {!taxonomy?.types.length ? (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      The store has no product types yet.
                    </Text>
                  ) : null}
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Categories
                  </Label>
                  <Chips
                    items={(taxonomy?.categories ?? []).map((category) => ({
                      id: category.id,
                      label: category.name,
                    }))}
                    selected={categoryIds}
                    setSelected={setCategoryIds}
                    empty="The store has no categories yet."
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Tags
                  </Label>
                  <Chips
                    items={(taxonomy?.tags ?? []).map((tag) => ({
                      id: tag.id,
                      label: tag.value,
                    }))}
                    selected={tagIds}
                    setSelected={setTagIds}
                    empty="The store has no tags yet."
                  />
                </div>
              </>
            )}
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
