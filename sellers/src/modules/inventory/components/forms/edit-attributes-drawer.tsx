"use client"

import {
  updateVendorInventoryItem,
  type VendorInventoryItem,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type EditAttributesDrawerProps = {
  item: VendorInventoryItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const EditAttributesDrawer = ({
  item,
  open,
  onOpenChange,
  onSuccess,
}: EditAttributesDrawerProps) => {
  const queryClient = useQueryClient()

  const [requiresShipping, setRequiresShipping] = useState(true)
  const [width, setWidth] = useState("")
  const [length, setLength] = useState("")
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [originCountry, setOriginCountry] = useState("")
  const [material, setMaterial] = useState("")
  const [hsCode, setHsCode] = useState("")
  const [midCode, setMidCode] = useState("")

  useEffect(() => {
    if (open) {
      setRequiresShipping(item.requires_shipping ?? true)
      setWidth(item.width?.toString() ?? "")
      setLength(item.length?.toString() ?? "")
      setHeight(item.height?.toString() ?? "")
      setWeight(item.weight?.toString() ?? "")
      setOriginCountry(item.origin_country ?? "")
      setMaterial(item.material ?? "")
      setHsCode(item.hs_code ?? "")
      setMidCode(item.mid_code ?? "")
    }
  }, [item, open])

  const { mutateAsync: update, isPending } = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      updateVendorInventoryItem(item.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-inventory-item", item.id],
      })
      toast.success("Attributes updated.")
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update attributes."
      )
    },
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const num = (v: string) => (v.trim() === "" ? null : parseFloat(v))
    const txt = (v: string) => (v.trim() === "" ? null : v.trim())

    await update({
      height: num(height),
      width: num(width),
      length: num(length),
      weight: num(weight),
      mid_code: txt(midCode),
      material: txt(material),
      hs_code: txt(hsCode),
      origin_country: txt(originCountry),
      requires_shipping: requiresShipping,
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex flex-col">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Edit Attributes</Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle txt-small">
            Manage dimensions, shipping, and customs details.
          </Drawer.Description>
        </Drawer.Header>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <Drawer.Body className="flex flex-1 flex-col gap-y-6 overflow-auto p-6">
            <div className="bg-ui-bg-subtle border-ui-border-base flex items-center justify-between rounded-lg border p-3">
              <div>
                <Text size="small" weight="plus">
                  Requires Shipping
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Toggle whether this item requires physical delivery.
                </Text>
              </div>
              <Switch
                checked={requiresShipping}
                onCheckedChange={setRequiresShipping}
              />
            </div>

            <div className="flex flex-col gap-y-3">
              <Heading
                level="h3"
                className="txt-compact-small-plus text-ui-fg-subtle uppercase"
              >
                Dimensions
              </Heading>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-y-1.5">
                  <Label size="small">Width (cm)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-y-1.5">
                  <Label size="small">Length (cm)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-y-1.5">
                  <Label size="small">Height (cm)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-y-1.5">
                  <Label size="small">Weight (g)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-y-3">
              <Heading
                level="h3"
                className="txt-compact-small-plus text-ui-fg-subtle uppercase"
              >
                Customs & Origin
              </Heading>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-y-1.5">
                  <Label size="small">Country of Origin</Label>
                  <Input
                    value={originCountry}
                    onChange={(e) => setOriginCountry(e.target.value)}
                    placeholder="e.g. US, IN, CN"
                    maxLength={2}
                  />
                </div>
                <div className="flex flex-col gap-y-1.5">
                  <Label size="small">Material</Label>
                  <Input
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder="e.g. 100% Cotton"
                  />
                </div>
                <div className="flex flex-col gap-y-1.5">
                  <Label size="small">HS Code</Label>
                  <Input
                    value={hsCode}
                    onChange={(e) => setHsCode(e.target.value)}
                    placeholder="e.g. 6109.10.00"
                  />
                </div>
                <div className="flex flex-col gap-y-1.5">
                  <Label size="small">MID Code</Label>
                  <Input
                    value={midCode}
                    onChange={(e) => setMidCode(e.target.value)}
                    placeholder="e.g. US12345"
                  />
                </div>
              </div>
            </div>
          </Drawer.Body>

          <Drawer.Footer className="border-ui-border-base flex items-center justify-end gap-x-2 border-t p-4">
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="small" isLoading={isPending}>
              Save
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
