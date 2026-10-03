import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Button,
  Drawer,
  Input,
  Label,
  Select,
  toast,
  Badge,
  Table,
} from "@medusajs/ui"
import { useQuery, useMutation } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { useEffect, useState } from "react"

type EoiValueType = "fixed" | "percentage"

type EoiConfig = {
  id: string
  variant_id: string
  value_type: EoiValueType
  value_amount: number
  status: "active" | "inactive"
}

type VariantWithEoiConfig = {
  id: string
  title: string | null
  sku: string | null
  eoi_configuration: EoiConfig | null
}

type VariantsResponse = {
  // Explicit field list via the product variants list endpoint, not a
  // fields: ["*"] on product - this widget doesn't trust DetailWidgetProps's
  // injected product to carry eoi_configuration per variant, since that
  // depends on which fields the admin's own product list query happened to
  // request; fetching here keeps this widget correct regardless.
  variants: VariantWithEoiConfig[]
}

/**
 * Expression of Interest configuration, one row per variant (see
 * docs/plan/EOI_VARIANT_LEVEL_CONFIG_PLAN.md) - a fixed amount can now
 * differ between a product's variants, so each variant gets its own
 * enable/edit/deactivate control instead of one shared form for the whole
 * product.
 */
const ProductEoiConfigWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [valueType, setValueType] = useState<EoiValueType>("percentage")
  const [valueAmount, setValueAmount] = useState(0)

  // /admin/products/:id/variants, not /admin/product-variants?product_id=...:
  // the latter's query validator (AdminGetProductVariantsParamsFields) does not
  // recognize product_id as a filter and silently drops it, so every product
  // showed "no variants" regardless of how many it actually had. This route
  // takes the product id from the URL path instead, which cannot be stripped.
  const { data, isLoading, refetch } = useQuery<VariantsResponse>({
    queryFn: () =>
      sdk.client.fetch(`/admin/products/${product.id}/variants`, {
        query: {
          fields: ["id", "title", "sku", "eoi_configuration.*"],
          limit: 999,
        },
      }),
    queryKey: [["products", product.id, "variants", "eoi-config"]],
  })

  const variants = data?.variants ?? []
  const editingVariant = variants.find((v) => v.id === editingVariantId) ?? null

  const upsertMutation = useMutation({
    mutationFn: async ({
      variantId,
      config,
    }: {
      variantId: string
      config: {
        value_type?: EoiValueType
        value_amount?: number
        status?: "active" | "inactive"
      }
    }) => {
      return sdk.client.fetch(
        `/admin/products/${product.id}/variants/${variantId}/eoi-config`,
        {
          method: "POST",
          body: config,
        }
      )
    },
    onSuccess: () => {
      toast.success("Expression of Interest configuration updated successfully")
      refetch()
      setEditingVariantId(null)
    },
    onError: () => {
      toast.error("Failed to update Expression of Interest configuration")
    },
  })

  useEffect(() => {
    if (editingVariant?.eoi_configuration) {
      setValueType(editingVariant.eoi_configuration.value_type ?? "percentage")
      setValueAmount(editingVariant.eoi_configuration.value_amount ?? 0)
    } else if (editingVariant) {
      setValueType("percentage")
      setValueAmount(0)
    }
  }, [editingVariant])

  const openDrawer = (variantId: string) => {
    setEditingVariantId(variantId)
  }

  const handleSubmit = () => {
    if (!editingVariantId) return

    // Preserve the variant's existing status rather than forcing "active" -
    // editing just the amount on a deactivated variant must not silently
    // reactivate it. Only a brand-new config (no existing eoi_configuration)
    // defaults to "active".
    upsertMutation.mutate({
      variantId: editingVariantId,
      config: {
        value_type: valueType,
        value_amount: valueAmount,
        status: editingVariant?.eoi_configuration?.status ?? "active",
      },
    })
  }

  const handleToggleStatus = (variant: VariantWithEoiConfig) => {
    if (!variant.eoi_configuration) return

    const newStatus = variant.eoi_configuration.status === "active" ? "inactive" : "active"

    upsertMutation.mutate({
      variantId: variant.id,
      config: { status: newStatus },
    })
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Expression of Interest</Heading>
        </div>

        {isLoading && (
          <div className="px-6 py-4">
            <Text className="text-ui-fg-subtle">Loading...</Text>
          </div>
        )}

        {!isLoading && variants.length === 0 && (
          <div className="px-6 py-4">
            <Text className="text-ui-fg-subtle">This product has no variants.</Text>
          </div>
        )}

        {!isLoading && variants.length > 0 && (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Variant</Table.HeaderCell>
                <Table.HeaderCell>Value</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {variants.map((variant) => (
                <Table.Row key={variant.id}>
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {variant.title ?? variant.sku ?? variant.id}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {variant.eoi_configuration ? (
                      variant.eoi_configuration.value_type === "percentage" ? (
                        `${variant.eoi_configuration.value_amount}% of price`
                      ) : (
                        variant.eoi_configuration.value_amount.toFixed(2)
                      )
                    ) : (
                      <Text className="text-ui-fg-subtle">Not configured</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {variant.eoi_configuration && (
                      <Badge
                        color={variant.eoi_configuration.status === "active" ? "green" : "grey"}
                        size="2xsmall"
                      >
                        {variant.eoi_configuration.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => openDrawer(variant.id)}
                      >
                        {variant.eoi_configuration ? "Edit" : "Enable"}
                      </Button>
                      {variant.eoi_configuration && (
                        <Button
                          size="small"
                          variant="primary"
                          onClick={() => handleToggleStatus(variant)}
                          disabled={upsertMutation.isPending}
                          isLoading={
                            upsertMutation.isPending &&
                            upsertMutation.variables?.variantId === variant.id
                          }
                        >
                          {variant.eoi_configuration.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>

      <Drawer open={!!editingVariantId} onOpenChange={(open) => !open && setEditingVariantId(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {editingVariant?.eoi_configuration ? "Edit" : "Add"} Expression of Interest
              {editingVariant ? ` — ${editingVariant.title ?? editingVariant.sku ?? ""}` : ""}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="value_type">Value Type</Label>
              <div className="flex gap-2">
                <Select
                  value={valueType}
                  onValueChange={(value) => setValueType(value as EoiValueType)}
                >
                  <Select.Trigger id="value_type" className="w-48">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="fixed">Fixed amount</Select.Item>
                    <Select.Item value="percentage">% of price</Select.Item>
                  </Select.Content>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valueAmount}
                  onChange={(e) => setValueAmount(Number(e.target.value))}
                />
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">
                A customer reserves this variant by paying this amount now, as a deposit
                toward the full price at checkout.
              </Text>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditingVariantId(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={upsertMutation.isPending}
                isLoading={upsertMutation.isPending}
              >
                Save
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductEoiConfigWidget
