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
  Select,
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

const COUNTRIES = [
  { label: "United States", value: "US" },
  { label: "United Kingdom", value: "GB" },
  { label: "Germany", value: "DE" },
  { label: "France", value: "FR" },
  { label: "India", value: "IN" },
  { label: "China", value: "CN" },
  { label: "Japan", value: "JP" },
  { label: "Canada", value: "CA" },
  { label: "Australia", value: "AU" },
  { label: "Italy", value: "IT" },
  { label: "Spain", value: "ES" },
  { label: "Netherlands", value: "NL" },
]

export const EditAttributesDrawer = ({
  item,
  open,
  onOpenChange,
  onSuccess,
}: EditAttributesDrawerProps) => {
  const queryClient = useQueryClient()

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
      toast.success("Inventory item updated successfully.")
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
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex flex-col">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Edit Attributes</Heading>
          </Drawer.Title>
        </Drawer.Header>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-auto p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Height (cm)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Width (cm)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Length (cm)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-1.5">
                <Label size="small" weight="plus">
                  Weight (g)
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                MID Code
              </Label>
              <Input
                value={midCode}
                onChange={(e) => setMidCode(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                Material
              </Label>
              <Input
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                HS Code
              </Label>
              <Input
                value={hsCode}
                onChange={(e) => setHsCode(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-1.5">
              <Label size="small" weight="plus">
                Country of origin
              </Label>
              <Select
                value={originCountry}
                onValueChange={setOriginCountry}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Select a country" />
                </Select.Trigger>
                <Select.Content>
                  {COUNTRIES.map((c) => (
                    <Select.Item key={c.value} value={c.value}>
                      {c.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
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
