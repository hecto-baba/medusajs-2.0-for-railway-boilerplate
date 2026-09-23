"use client"

import {
  batchVendorOptions,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Drawer,
  Input,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Row, Section } from "./section"

/**
 * Product options - "Size: S, M, L" - and the drawer that edits them.
 *
 * Values are entered comma-separated rather than as a tag input: the admin
 * uses a chip editor, which is a lot of interaction code for something a
 * seller sets once per product.
 */
export const OptionsSection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [values, setValues] = useState("")

  const options = product.options ?? []

  const { mutateAsync: addOption, isPending } = useMutation({
    mutationFn: () =>
      batchVendorOptions(product.id, {
        add: [
          {
            title: title.trim(),
            values: values
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          },
        ],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-product", product.id] })
    },
  })

  const { mutateAsync: removeOption } = useMutation({
    mutationFn: (id: string) =>
      batchVendorOptions(product.id, { remove: [id] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-product", product.id] })
    },
  })

  const onAdd = async () => {
    const parsed = values
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)

    if (!title.trim()) {
      toast.error("Give the option a name, such as Size.")
      return
    }

    if (!parsed.length) {
      toast.error("Add at least one value, such as S, M, L.")
      return
    }

    try {
      await addOption()
      toast.success(`"${title.trim()}" added.`)
      setTitle("")
      setValues("")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add the option."
      )
    }
  }

  const onRemove = async (id: string, label: string) => {
    try {
      await removeOption(id)
      toast.success(`"${label}" removed.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove the option."
      )
    }
  }

  return (
    <Section
      title="Options"
      actions={
        <Drawer open={open} onOpenChange={setOpen}>
          <Drawer.Trigger asChild>
            <Button size="small" variant="secondary">
              Add option
            </Button>
          </Drawer.Trigger>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>Add option</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus" htmlFor="option-title">
                  Name
                </Label>
                <Input
                  id="option-title"
                  placeholder="Size"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus" htmlFor="option-values">
                  Values
                </Label>
                <Input
                  id="option-values"
                  placeholder="S, M, L"
                  value={values}
                  onChange={(event) => setValues(event.target.value)}
                />
                <Text size="xsmall" className="text-ui-fg-muted">
                  Separate values with commas.
                </Text>
              </div>
            </Drawer.Body>
            <Drawer.Footer>
              <Button
                size="small"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button size="small" onClick={onAdd} isLoading={isPending}>
                Add
              </Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer>
      }
    >
      {options.length ? (
        options.map((option) => (
          <Row key={option.id} label={option.title}>
            <div className="flex items-center justify-between gap-x-2">
              <div className="flex flex-wrap gap-1">
                {(option.values ?? []).map((value) => (
                  <Badge key={value.id} size="small">
                    {value.value}
                  </Badge>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onRemove(option.id, option.title)}
                className="text-ui-fg-muted hover:text-ui-fg-base txt-compact-small shrink-0"
              >
                Remove
              </button>
            </div>
          </Row>
        ))
      ) : (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-muted">
            No options yet. Add one to sell this product in several variations.
          </Text>
        </div>
      )}
    </Section>
  )
}
