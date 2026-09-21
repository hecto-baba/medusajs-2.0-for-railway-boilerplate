"use client"

import {
  createVendorTaxRegion,
  type VendorTaxRegion,
} from "@lib/data/vendor-client"
import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

const ALL_COUNTRIES = [
  { code: "us", name: "United States" },
  { code: "gb", name: "United Kingdom" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "in", name: "India" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "jp", name: "Japan" },
  { code: "it", name: "Italy" },
  { code: "es", name: "Spain" },
  { code: "nl", name: "Netherlands" },
  { code: "se", name: "Sweden" },
  { code: "dk", name: "Denmark" },
  { code: "ae", name: "United Arab Emirates" },
  { code: "sg", name: "Singapore" },
]

type TaxRegionCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (taxRegion: VendorTaxRegion) => void
}

export const TaxRegionCreateModal = ({
  open,
  onOpenChange,
  onSuccess,
}: TaxRegionCreateModalProps) => {
  const queryClient = useQueryClient()

  const [countryCode, setCountryCode] = useState("us")
  const [rate, setRate] = useState("10")
  const [name, setName] = useState("Standard Tax")
  const [code, setCode] = useState("TAX")

  const createMutation = useMutation({
    mutationFn: (body: {
      country_code: string
      rate?: number
      name?: string
      code?: string
    }) => createVendorTaxRegion(body),
    onSuccess: (data) => {
      toast.success("Tax region created successfully.")
      queryClient.invalidateQueries({ queryKey: ["vendor-tax-regions"] })
      onOpenChange(false)
      onSuccess?.(data.tax_region)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create tax region.")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!countryCode) {
      toast.error("Country is required.")
      return
    }

    const numericRate = parseFloat(rate)
    if (isNaN(numericRate) || numericRate < 0 || numericRate > 100) {
      toast.error("Tax rate must be a valid number between 0 and 100.")
      return
    }

    createMutation.mutate({
      country_code: countryCode.toLowerCase(),
      rate: numericRate,
      name: name.trim() || undefined,
      code: code.trim() || undefined,
    })
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Create Tax Region</Heading>
            </FocusModal.Title>
            <FocusModal.Description className="text-ui-fg-subtle text-sm">
              Configure tax calculation rules and standard rate for a country.
            </FocusModal.Description>
          </div>
          <div className="flex items-center gap-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              isLoading={createMutation.isPending}
              onClick={handleSubmit}
            >
              Save Tax Region
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full flex flex-col gap-y-5">
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Country <span className="text-ui-fg-error">*</span>
            </Label>
            <Select value={countryCode} onValueChange={setCountryCode}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {ALL_COUNTRIES.map((c) => (
                  <Select.Item key={c.code} value={c.code}>
                    {c.name} ({c.code.toUpperCase()})
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Default Tax Rate (%) <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="e.g. 20"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-x-4">
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
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
