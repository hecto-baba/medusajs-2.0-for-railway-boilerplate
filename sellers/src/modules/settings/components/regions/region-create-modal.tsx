"use client"

import { createVendorRegion, type VendorRegion } from "@lib/data/vendor-client"
import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

const COMMON_COUNTRIES = [
  { code: "us", name: "United States" },
  { code: "ca", name: "Canada" },
  { code: "gb", name: "United Kingdom" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "in", name: "India" },
  { code: "au", name: "Australia" },
  { code: "jp", name: "Japan" },
  { code: "ae", name: "United Arab Emirates" },
  { code: "sg", name: "Singapore" },
]

const COMMON_CURRENCIES = [
  { code: "usd", label: "USD - US Dollar" },
  { code: "eur", label: "EUR - Euro" },
  { code: "gbp", label: "GBP - British Pound" },
  { code: "cad", label: "CAD - Canadian Dollar" },
  { code: "aud", label: "AUD - Australian Dollar" },
  { code: "inr", label: "INR - Indian Rupee" },
  { code: "jpy", label: "JPY - Japanese Yen" },
  { code: "aed", label: "AED - UAE Dirham" },
]

type RegionCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (region: VendorRegion) => void
}

export const RegionCreateModal = ({
  open,
  onOpenChange,
  onSuccess,
}: RegionCreateModalProps) => {
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [currencyCode, setCurrencyCode] = useState("usd")
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["us"])

  const createMutation = useMutation({
    mutationFn: (body: {
      name: string
      currency_code: string
      countries: string[]
    }) => createVendorRegion(body),
    onSuccess: (data) => {
      toast.success("Region created successfully.")
      queryClient.invalidateQueries({ queryKey: ["vendor-regions"] })
      onOpenChange(false)
      setName("")
      setCurrencyCode("usd")
      setSelectedCountries(["us"])
      onSuccess?.(data.region)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create region.")
    },
  })

  const handleToggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Region name is required.")
      return
    }

    if (selectedCountries.length === 0) {
      toast.error("Select at least one country for this region.")
      return
    }

    createMutation.mutate({
      name: name.trim(),
      currency_code: currencyCode.toLowerCase(),
      countries: selectedCountries,
    })
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Create Region</Heading>
            </FocusModal.Title>
            <FocusModal.Description className="text-ui-fg-subtle text-sm">
              Add a new sales and shipping region with assigned currency and countries.
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
              Save Region
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex-1 overflow-y-auto p-6 max-w-xl mx-auto w-full flex flex-col gap-y-5">
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Region Name <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              placeholder="e.g. North America, European Union"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Default Currency <span className="text-ui-fg-error">*</span>
            </Label>
            <Select value={currencyCode} onValueChange={setCurrencyCode}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {COMMON_CURRENCIES.map((c) => (
                  <Select.Item key={c.code} value={c.code}>
                    {c.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Countries in this Region <span className="text-ui-fg-error">*</span>
            </Label>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Select the countries belonging to this region.
            </Text>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-ui-border-base p-3 bg-ui-bg-subtle">
              {COMMON_COUNTRIES.map((c) => {
                const checked = selectedCountries.includes(c.code)
                return (
                  <label
                    key={c.code}
                    onClick={() => handleToggleCountry(c.code)}
                    className={`flex items-center gap-x-2 p-2 rounded cursor-pointer text-xs transition-colors ${
                      checked
                        ? "bg-ui-bg-interactive/10 text-ui-fg-interactive font-medium"
                        : "hover:bg-ui-bg-field text-ui-fg-base"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="rounded border-ui-border-base text-ui-fg-interactive"
                    />
                    <span>{c.name} ({c.code.toUpperCase()})</span>
                  </label>
                )
              })}
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
