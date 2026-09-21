"use client"

import {
  updateVendorTaxRate,
  type VendorTaxRegion,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type TaxRegionEditDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  taxRegion: VendorTaxRegion | null
  onSuccess?: () => void
}

export const TaxRegionEditDrawer = ({
  open,
  onOpenChange,
  taxRegion,
  onSuccess,
}: TaxRegionEditDrawerProps) => {
  const queryClient = useQueryClient()

  const [rate, setRate] = useState("0")
  const [name, setName] = useState("Standard Tax")
  const [code, setCode] = useState("TAX")

  useEffect(() => {
    if (taxRegion) {
      setRate(
        taxRegion.raw_rate !== null && taxRegion.raw_rate !== undefined
          ? String(taxRegion.raw_rate)
          : taxRegion.rate.replace("%", "")
      )
      setName(taxRegion.rate_name || "Standard Tax")
      setCode(taxRegion.rate_code || "TAX")
    }
  }, [taxRegion])

  const updateMutation = useMutation({
    mutationFn: (body: { rate: number; name?: string; code?: string }) => {
      if (!taxRegion) throw new Error("No tax region selected")
      return updateVendorTaxRate(taxRegion.id, body)
    },
    onSuccess: () => {
      toast.success("Default tax rate updated successfully.")
      queryClient.invalidateQueries({ queryKey: ["vendor-tax-regions"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update tax rate.")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const numericRate = parseFloat(rate)
    if (isNaN(numericRate) || numericRate < 0 || numericRate > 100) {
      toast.error("Tax rate must be a valid number between 0 and 100.")
      return
    }

    updateMutation.mutate({
      rate: numericRate,
      name: name.trim() || undefined,
      code: code.trim() || undefined,
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex flex-col">
        <Drawer.Header className="border-b p-4">
          <Drawer.Title asChild>
            <Heading level="h2">Edit Default Tax Rate</Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            Update the default tax rate applied for {taxRegion?.country_code}.
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
          <Drawer.Body className="p-6 flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Country
              </Label>
              <Input value={taxRegion?.country_code || ""} disabled />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Tax Rate (%) <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Rate Name
              </Label>
              <Input
                placeholder="Standard Tax"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Tax Code
              </Label>
              <Input
                placeholder="VAT"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </Drawer.Body>

          <Drawer.Footer className="border-t p-4 flex items-center justify-end gap-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={updateMutation.isPending}
            >
              Save Rate
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
