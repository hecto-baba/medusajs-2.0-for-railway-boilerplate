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
} from "@medusajs/ui"
import { useQuery, useMutation } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { useEffect, useState } from "react"

type EoiValueType = "fixed" | "percentage"

type EoiConfig = {
  id: string
  product_id: string
  value_type: EoiValueType
  value_amount: number
  status: "active" | "inactive"
}

type EoiConfigResponse = {
  eoi_config: EoiConfig | null
}

const ProductEoiConfigWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [valueType, setValueType] = useState<EoiValueType>("percentage")
  const [valueAmount, setValueAmount] = useState(0)

  const { data, isLoading, refetch } = useQuery<EoiConfigResponse>({
    queryFn: () =>
      sdk.client.fetch(`/admin/products/${product.id}/eoi-config`),
    queryKey: [["products", product.id, "eoi-config"]],
  })

  const upsertMutation = useMutation({
    mutationFn: async (config: {
      value_type?: EoiValueType
      value_amount?: number
      status?: "active" | "inactive"
    }) => {
      return sdk.client.fetch(`/admin/products/${product.id}/eoi-config`, {
        method: "POST",
        body: config,
      })
    },
    onSuccess: () => {
      toast.success("Expression of Interest configuration updated successfully")
      refetch()
      setDrawerOpen(false)
    },
    onError: () => {
      toast.error("Failed to update Expression of Interest configuration")
    },
  })

  useEffect(() => {
    if (data?.eoi_config) {
      const config = data.eoi_config
      setValueType(config.value_type ?? "percentage")
      setValueAmount(config.value_amount ?? 0)
    }
  }, [data?.eoi_config])

  const handleOpenDrawer = () => {
    setDrawerOpen(true)
  }

  const handleSubmit = () => {
    upsertMutation.mutate({
      value_type: valueType,
      value_amount: valueAmount,
      status: "active",
    })
  }

  const handleToggleStatus = () => {
    if (!data?.eoi_config) return

    const newStatus = data.eoi_config.status === "active" ? "inactive" : "active"

    upsertMutation.mutate({
      status: newStatus,
    })
  }

  const activeConfig = data?.eoi_config

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Expression of Interest</Heading>
          {!isLoading && data?.eoi_config && (
            <Badge color={data.eoi_config.status === "active" ? "green" : "grey"} size="2xsmall">
              {data.eoi_config.status === "active" ? "Active" : "Inactive"}
            </Badge>
          )}
        </div>

        {isLoading && (
          <div className="px-6 py-4">
            <Text className="text-ui-fg-subtle">Loading...</Text>
          </div>
        )}

        {!isLoading && !data?.eoi_config && (
          <>
            <div className="px-6 py-4">
              <Text className="text-ui-fg-subtle">
                This product is not currently eligible for Expression of Interest.
              </Text>
            </div>
            <div className="flex justify-end border-t px-6 py-4">
              <Button size="small" onClick={handleOpenDrawer} variant="secondary">
                Enable Expression of Interest
              </Button>
            </div>
          </>
        )}

        {!isLoading && data?.eoi_config && (
          <div className="divide-y">
            <div className="grid grid-cols-2 items-center px-6 py-4">
              <Text size="small" weight="plus" className="mb-1">
                Value Type
              </Text>
              <Text className="text-ui-fg-subtle text-right">
                {activeConfig?.value_type === "percentage" ? "Percentage of price" : "Fixed amount"}
              </Text>
            </div>
            <div className="grid grid-cols-2 items-center px-6 py-4">
              <Text size="small" weight="plus" className="mb-1">
                Value
              </Text>
              <Text className="text-ui-fg-subtle text-right">
                {activeConfig?.value_type === "percentage"
                  ? `${activeConfig.value_amount}% of price`
                  : activeConfig?.value_amount?.toFixed(2)}
              </Text>
            </div>
            <div className="flex gap-2 px-6 py-4 justify-end">
              <Button size="small" variant="secondary" onClick={handleOpenDrawer}>
                Edit
              </Button>
              <Button
                size="small"
                variant="primary"
                onClick={handleToggleStatus}
                disabled={upsertMutation.isPending}
                isLoading={upsertMutation.isPending}
              >
                {data.eoi_config.status === "active" ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>
        )}
      </Container>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {data?.eoi_config ? "Edit" : "Add"} Expression of Interest Configuration
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
                A customer reserves this product by paying this amount now, as a deposit
                toward the full price at checkout.
              </Text>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
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
