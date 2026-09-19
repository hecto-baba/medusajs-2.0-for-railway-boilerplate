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
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
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
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) => (
  <div className="bg-ui-bg-base shadow-elevation-card-rest flex flex-col gap-y-4 rounded-lg p-6">
    <div className="flex flex-col gap-y-1">
      <Heading level="h2">{title}</Heading>
      {description ? (
        <Text size="small" className="text-ui-fg-subtle">
          {description}
        </Text>
      ) : null}
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
 *
 * Storing it as a number would turn an empty input into 0 on every render,
 * which is a different thing from "unset" - the API treats null as unset and
 * 0 as a real measurement.
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

  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)

  return Number.isNaN(parsed) ? null : parsed
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
  const [handle, setHandle] = useState(product?.handle ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [status, setStatus] = useState(product?.status ?? "draft")
  const [discountable, setDiscountable] = useState(
    product?.discountable ?? true
  )
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [categoryIds, setCategoryIds] = useState<string[]>(
    product?.categories?.map((c) => c.id) ?? []
  )

  // Attributes
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
        material: text(material),
        hs_code: text(hsCode),
        mid_code: text(midCode),
        origin_country: text(originCountry),
        weight: num(weight),
        length: num(length),
        height: num(height),
        width: num(width),
      }

      if (isEdit) {
        return updateVendorProduct(product!.id, {
          ...base,
          categories: categoryIds.map((id) => ({ id })),
          // Only sent when the seller actually changed it: the API rejects a
          // handle that collides with another product, and resending the
          // unchanged one is a needless way to hit that.
          ...(handle.trim() && handle.trim() !== product!.handle
            ? { handle: handle.trim() }
            : {}),
        })
      }

      return createVendorProduct({
        ...base,
        ...(handle.trim() ? { handle: handle.trim() } : {}),
        ...(categoryIds.length > 0
          ? { categories: categoryIds.map((id) => ({ id })) }
          : {}),
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
            prices: Object.entries(prices)
              .filter(([, value]) => value.trim() !== "")
              .map(([currency_code, value]) => ({
                currency_code,
                amount: Number(value),
              })),
          },
        ],
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
      setError("A title is required.")
      return
    }

    if (!isEdit) {
      const filled = Object.entries(prices).filter(
        ([, value]) => value.trim() !== ""
      )

      // A product whose only variant has no price cannot be bought anywhere.
      if (!filled.length) {
        setError("Enter a price in at least one currency.")
        return
      }

      if (
        filled.some(
          ([, value]) => Number.isNaN(Number(value)) || Number(value) < 0
        )
      ) {
        setError("Prices must be zero or more.")
        return
      }
    }

    try {
      await save()
      toast.success(isEdit ? "Product updated." : "Product created.")
      // Edits return to the product rather than the list, so the seller can
      // see the change they just made in context.
      router.push(isEdit ? `/products/${product!.id}` : "/products")
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

      <Card
        title="Product Category & Classification"
        description="Assign a standardized category tailored to your registered business vertical to optimize discovery and storefront classification."
      >
        <TrustClawCategoryPicker
          selectedMedusaCategoryId={categoryIds[0] ?? null}
          selectedCategoryName={product?.categories?.[0]?.name ?? null}
          onSelectCategory={(categoryId) => {
            setCategoryIds(categoryId ? [categoryId] : [])
          }}
        />
      </Card>

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

        {!isEdit && (
          <div className="flex flex-col gap-y-2">
            <PriceFields prices={prices} onChange={setPrices} />
            <Text size="small" className="text-ui-fg-subtle">
              Sets the price of the product&apos;s first variant. You can add
              more variants and prices after creating it.
            </Text>
          </div>
        )}

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
