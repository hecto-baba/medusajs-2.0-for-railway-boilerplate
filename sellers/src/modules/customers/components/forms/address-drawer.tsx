"use client"

import {
  createVendorCustomerAddress,
  updateVendorCustomerAddress,
  type VendorCustomerAddress,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type AddressDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  address?: VendorCustomerAddress | null
  onSuccess?: () => void
}

export const AddressDrawer = ({
  open,
  onOpenChange,
  customerId,
  address,
  onSuccess,
}: AddressDrawerProps) => {
  const isEditing = Boolean(address)
  const queryClient = useQueryClient()

  const [addressName, setAddressName] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [company, setCompany] = useState("")
  const [address1, setAddress1] = useState("")
  const [address2, setAddress2] = useState("")
  const [city, setCity] = useState("")
  const [countryCode, setCountryCode] = useState("us")
  const [province, setProvince] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [phone, setPhone] = useState("")

  useEffect(() => {
    if (address) {
      setAddressName(address.address_name || "")
      setFirstName(address.first_name || "")
      setLastName(address.last_name || "")
      setCompany(address.company || "")
      setAddress1(address.address_1 || "")
      setAddress2(address.address_2 || "")
      setCity(address.city || "")
      setCountryCode(address.country_code || "us")
      setProvince(address.province || "")
      setPostalCode(address.postal_code || "")
      setPhone(address.phone || "")
    } else {
      setAddressName("")
      setFirstName("")
      setLastName("")
      setCompany("")
      setAddress1("")
      setAddress2("")
      setCity("")
      setCountryCode("us")
      setProvince("")
      setPostalCode("")
      setPhone("")
    }
  }, [address, open])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      createVendorCustomerAddress(customerId, data),
    onSuccess: () => {
      toast.success("Address added successfully")
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer", customerId],
      })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add address")
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      updateVendorCustomerAddress(customerId, address!.id, data),
    onSuccess: () => {
      toast.success("Address updated successfully")
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer", customerId],
      })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update address")
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!address1.trim()) {
      toast.error("Address line 1 is required")
      return
    }

    if (!countryCode.trim()) {
      toast.error("Country code is required")
      return
    }

    const payload: Record<string, unknown> = {
      address_name: addressName.trim() || null,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      company: company.trim() || null,
      address_1: address1.trim(),
      address_2: address2.trim() || null,
      city: city.trim() || null,
      country_code: countryCode.trim().toLowerCase(),
      province: province.trim() || null,
      postal_code: postalCode.trim() || null,
      phone: phone.trim() || null,
    }

    if (isEditing) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-md">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">
              {isEditing ? "Edit Address" : "Add Address"}
            </Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            {isEditing
              ? "Update this shipping or billing address."
              : "Add a new address for this customer."}
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between">
          <Drawer.Body className="flex flex-col gap-y-4 p-6 overflow-y-auto">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Address Name / Label
              </Label>
              <Input
                placeholder="e.g. Home, Office, HQ"
                value={addressName}
                onChange={(e) => setAddressName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-x-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  First Name
                </Label>
                <Input
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Last Name
                </Label>
                <Input
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Company
              </Label>
              <Input
                placeholder="Acme Corp"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Address Line 1 <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                placeholder="123 Main Street"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Address Line 2
              </Label>
              <Input
                placeholder="Suite 400"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-x-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  City
                </Label>
                <Input
                  placeholder="New York"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Province / State
                </Label>
                <Input
                  placeholder="NY"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4">
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
                  Country Code <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  placeholder="us"
                  maxLength={2}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Phone Number
              </Label>
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </Drawer.Body>

          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending}>
              {isEditing ? "Save Address" : "Add Address"}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
