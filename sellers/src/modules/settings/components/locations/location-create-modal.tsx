"use client"

import {
  createVendorStockLocation,
  type VendorStockLocation,
} from "@lib/data/vendor-client"
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

type LocationCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (location: VendorStockLocation) => void
}

export const LocationCreateModal = ({
  open,
  onOpenChange,
  onSuccess,
}: LocationCreateModalProps) => {
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [address1, setAddress1] = useState("")
  const [address2, setAddress2] = useState("")
  const [city, setCity] = useState("")
  const [countryCode, setCountryCode] = useState("us")
  const [postalCode, setPostalCode] = useState("")
  const [province, setProvince] = useState("")
  const [company, setCompany] = useState("")

  const resetForm = () => {
    setName("")
    setAddress1("")
    setAddress2("")
    setCity("")
    setCountryCode("us")
    setPostalCode("")
    setProvince("")
    setCompany("")
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createVendorStockLocation({
        name: name.trim(),
        address: {
          address_1: address1.trim() || undefined,
          address_2: address2.trim() || undefined,
          city: city.trim() || undefined,
          country_code: countryCode.toLowerCase(),
          postal_code: postalCode.trim() || undefined,
          province: province.trim() || undefined,
          company: company.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success("Stock location created successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-stock-locations"] })
      onOpenChange(false)
      resetForm()
      onSuccess?.(res.stock_location)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create location")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Location name is required")
      return
    }

    createMutation.mutate()
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Add Location</Heading>
            </FocusModal.Title>
            <FocusModal.Description className="text-ui-fg-subtle text-sm">
              Create a new fulfillment or warehouse location for your inventory.
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
              isLoading={createMutation.isPending}
              onClick={handleSubmit}
            >
              Save Location
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 flex-col gap-y-6 p-6 max-w-2xl mx-auto w-full overflow-y-auto">
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Location Name <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              placeholder="e.g. Primary Warehouse, Flagship Store"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="border-t pt-4">
            <Heading level="h3" className="mb-4">
              Address Details
            </Heading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-2 md:col-span-2">
                <Label size="small" weight="plus">
                  Address Line 1
                </Label>
                <Input
                  placeholder="Street address"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2 md:col-span-2">
                <Label size="small" weight="plus">
                  Address Line 2
                </Label>
                <Input
                  placeholder="Apartment, suite, unit, etc."
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  City
                </Label>
                <Input
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Postal Code
                </Label>
                <Input
                  placeholder="10001"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  State / Province
                </Label>
                <Input
                  placeholder="State or region"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Country Code (2 letters)
                </Label>
                <Input
                  placeholder="us"
                  maxLength={2}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toLowerCase())}
                />
              </div>

              <div className="flex flex-col gap-y-2 md:col-span-2">
                <Label size="small" weight="plus">
                  Company
                </Label>
                <Input
                  placeholder="Company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
