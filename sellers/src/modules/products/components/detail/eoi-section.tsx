"use client"

import {
  listVendorVariants,
  upsertVendorEoiConfig,
  type VendorEoiValueType,
  type VendorProduct,
  type VendorVariant,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Input,
  Label,
  Select,
  StatusBadge,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Section } from "./section"

/**
 * Expression of Interest terms, one row per variant (see
 * docs/plan/EOI_VARIANT_LEVEL_CONFIG_PLAN.md) - a fixed amount can now
 * differ between a product's variants, so each variant gets its own
 * enable/edit/deactivate control instead of one shared form for the whole
 * product. Mirrors the admin widget's same table restructure.
 *
 * Reads eoi_configuration directly off listVendorVariants's response (fix #4
 * of docs/plan/EOI_VARIANT_LEVEL_FIX_EXECUTION_PLAN.md) rather than firing
 * one request per variant - eoi_configuration.* was added to the backend
 * route's field list specifically for this, so one list call now carries
 * both the variant and its config.
 */
export const EoiSection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [valueType, setValueType] = useState<VendorEoiValueType>("percentage")
  const [valueAmount, setValueAmount] = useState(0)

  const { data: variantsData, isLoading: variantsLoading } = useQuery({
    queryKey: ["vendor-variants", product.id],
    queryFn: () => listVendorVariants(product.id),
    retry: false,
  })

  const variants: VendorVariant[] = variantsData?.variants ?? []
  const editingVariant = variants.find((v) => v.id === editingVariantId) ?? null
  const editingConfig = editingVariant?.eoi_configuration ?? null

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["vendor-variants", product.id],
    })

  const { mutateAsync: save, isPending, variables: pendingVariables } = useMutation({
    mutationFn: ({
      variantId,
      body,
    }: {
      variantId: string
      body: Parameters<typeof upsertVendorEoiConfig>[2]
    }) => upsertVendorEoiConfig(product.id, variantId, body),
    onSuccess: refresh,
  })

  useEffect(() => {
    if (editingConfig) {
      setValueType(editingConfig.value_type ?? "percentage")
      setValueAmount(editingConfig.value_amount ?? 0)
    } else if (editingVariantId) {
      setValueType("percentage")
      setValueAmount(0)
    }
  }, [editingConfig, editingVariantId])

  const openDrawer = (variantId: string) => setEditingVariantId(variantId)

  const onSave = async () => {
    if (!editingVariantId) {
      return
    }

    if (valueAmount < 0) {
      toast.error("Value cannot be negative.")
      return
    }

    if (valueType === "percentage" && valueAmount > 100) {
      toast.error("Percentage value cannot exceed 100.")
      return
    }

    try {
      await save({
        variantId: editingVariantId,
        body: {
          value_type: valueType,
          value_amount: valueAmount,
          status: editingConfig?.status ?? "active",
        },
      })
      toast.success("Expression of Interest configuration saved.")
      setEditingVariantId(null)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the Expression of Interest configuration."
      )
    }
  }

  const onToggleStatus = async (variant: VendorVariant) => {
    const config = variant.eoi_configuration
    if (!config) {
      return
    }

    const deactivating = config.status === "active"

    if (deactivating) {
      const confirmed = await prompt({
        title: "Deactivate Expression of Interest",
        description:
          "Shoppers will no longer be able to reserve this variant via Expression of Interest. Existing EOI orders are unaffected.",
        confirmText: "Deactivate",
        cancelText: "Cancel",
      })

      if (!confirmed) {
        return
      }
    }

    try {
      await save({
        variantId: variant.id,
        body: { status: deactivating ? "inactive" : "active" },
      })
      toast.success(
        deactivating ? "Expression of Interest deactivated." : "Expression of Interest activated."
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not change the status."
      )
    }
  }

  if (variantsLoading) {
    return (
      <Section title="Expression of Interest">
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-muted">
            Loading…
          </Text>
        </div>
      </Section>
    )
  }

  return (
    <Section title="Expression of Interest">
      {variants.length === 0 ? (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-muted">
            This product has no variants.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Variant</Table.HeaderCell>
              <Table.HeaderCell>Value</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {variants.map((variant) => {
              const config = variant.eoi_configuration ?? null

              return (
                <Table.Row key={variant.id}>
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {variant.title ?? variant.sku ?? variant.id}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {config ? (
                      config.value_type === "percentage" ? (
                        `${config.value_amount}% of price`
                      ) : (
                        config.value_amount.toFixed(2)
                      )
                    ) : (
                      <Text size="small" className="text-ui-fg-muted">
                        Not configured
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {config && (
                      <StatusBadge color={config.status === "active" ? "green" : "grey"}>
                        {config.status === "active" ? "Active" : "Inactive"}
                      </StatusBadge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-x-2">
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => openDrawer(variant.id)}
                      >
                        {config ? "Edit" : "Enable"}
                      </Button>
                      {config && (
                        <Button
                          size="small"
                          variant={config.status === "active" ? "danger" : "primary"}
                          onClick={() => onToggleStatus(variant)}
                          isLoading={isPending && pendingVariables?.variantId === variant.id}
                        >
                          {config.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      )}

      <Drawer open={!!editingVariantId} onOpenChange={(open) => !open && setEditingVariantId(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {editingConfig ? "Edit" : "Enable"} Expression of Interest
              {editingVariant ? ` — ${editingVariant.title ?? editingVariant.sku ?? ""}` : ""}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="eoi-value-type">
                Value Type
              </Label>
              <div className="flex gap-x-2">
                <Select
                  value={valueType}
                  onValueChange={(value) => setValueType(value as VendorEoiValueType)}
                >
                  <Select.Trigger id="eoi-value-type" className="w-40">
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
                  onChange={(event) => setValueAmount(Number(event.target.value))}
                />
              </div>
              <Text size="xsmall" className="text-ui-fg-muted">
                A customer reserves this variant by paying this amount now, as a deposit
                toward the full price at checkout.
              </Text>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setEditingVariantId(null)}
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
