"use client"

import {
  createVendorProduct,
  updateVendorProduct,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Button,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

// The store's default currency. A vendor cannot pick one, and a price needs a
// currency, so create uses this and sellers adjust per-region pricing later.
const DEFAULT_CURRENCY = "eur"

type ProductFormProps = {
  product?: VendorProduct
}

/**
 * Create and edit share one form: the fields are identical, and only the call
 * at submit differs. A create additionally has to send an option and a
 * variant, because a product with neither cannot be purchased.
 */
export const ProductForm = ({ product }: ProductFormProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isEdit = Boolean(product)

  const [title, setTitle] = useState(product?.title ?? "")
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [status, setStatus] = useState(product?.status ?? "draft")
  const [price, setPrice] = useState("")
  const [error, setError] = useState<string | null>(null)

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: async () => {
      const base = {
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
        status,
      }

      if (isEdit) {
        return updateVendorProduct(product!.id, base)
      }

      return createVendorProduct({
        ...base,
        // A product with no option and no variant cannot be added to a cart,
        // so a default pair is created alongside it. Sellers refine these
        // later on the product's own page.
        //
        // prices is not optional: the backend rejects a variant without one,
        // which is why the form asks for a price on create.
        options: [{ title: "Default", values: ["Default"] }],
        variants: [
          {
            title: "Default",
            options: { Default: "Default" },
            manage_inventory: false,
            prices: [
              { amount: Number(price), currency_code: DEFAULT_CURRENCY },
            ],
          },
        ],
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
    },
  })

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError("A title is required.")
      return
    }

    if (!isEdit && (!price.trim() || Number.isNaN(Number(price)) || Number(price) < 0)) {
      setError("Enter a price of zero or more.")
      return
    }

    try {
      await save()
      toast.success(isEdit ? "Product updated." : "Product created.")
      router.push("/products")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save the product."
      )
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-y-6">
      <div className="flex items-center justify-between">
        <Heading level="h1">
          {isEdit ? product!.title : "Create product"}
        </Heading>
        <div className="flex items-center gap-x-2">
          <Link href="/products">
            <Button variant="secondary" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" isLoading={isPending}>
            Save
          </Button>
        </div>
      </div>

      <div className="bg-ui-bg-base shadow-elevation-card-rest flex flex-col gap-y-4 rounded-lg p-6">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="title" size="small" weight="plus">
            Title
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Winter Jacket"
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label htmlFor="subtitle" size="small" weight="plus">
            Subtitle
          </Label>
          <Input
            id="subtitle"
            value={subtitle ?? ""}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label htmlFor="description" size="small" weight="plus">
            Description
          </Label>
          <Textarea
            id="description"
            rows={5}
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {!isEdit && (
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="price" size="small" weight="plus">
              Price ({DEFAULT_CURRENCY.toUpperCase()})
            </Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="19.99"
            />
            <Text size="small" className="text-ui-fg-subtle">
              Sets the price of the product&apos;s first variant. You can add
              more variants and prices after creating it.
            </Text>
          </div>
        )}

        <div className="flex flex-col gap-y-2">
          <Label size="small" weight="plus">
            Status
          </Label>
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
          <Text size="small" className="text-ui-fg-subtle">
            Only published products appear in the storefront.
          </Text>
        </div>

        {error && (
          <Text size="small" className="text-ui-fg-error">
            {error}
          </Text>
        )}
      </div>
    </form>
  )
}
