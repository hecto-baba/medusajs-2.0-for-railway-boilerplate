"use client"

import {
  createVendorCustomerAddress,
  updateVendorCustomerAddress,
  type VendorCustomerAddress,
} from "@lib/data/vendor-client"
import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import { CountrySelect } from "@modules/common"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type AddressModalProps = {
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
}: AddressModalProps) => {
  const isEditing = Boolean(address)
  const queryClient = useQueryClient()

  const [addressName, setAddressName] = useState("")
  const [address1, setAddress1] = useState("")
  const [address2, setAddress2] = useState("")
  const [city, setCity] = useState("")
  const [countryCode, setCountryCode] = useState("us")
  const [province, setProvince] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [company, setCompany] = useState("")
  const [phone, setPhone] = useState("")

  useEffect(() => {
    if (address) {
      setAddressName(address.address_name || "")
      setAddress1(address.address_1 || "")
      setAddress2(address.address_2 || "")
      setCity(address.city || "")
      setCountryCode(address.country_code?.toLowerCase() || "us")
      setProvince(address.province || "")
      setPostalCode(address.postal_code || "")
      setCompany(address.company || "")
      setPhone(address.phone || "")
    } else {
      setAddressName("")
      setAddress1("")
      setAddress2("")
      setCity("")
      setCountryCode("us")
      setProvince("")
      setPostalCode("")
      setCompany("")
      setPhone("")
    }
  }, [address, open])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      createVendorCustomerAddress(customerId, data),
    onSuccess: () => {
      toast.success("Address was successfully created.")
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer", customerId],
      })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create address")
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      updateVendorCustomerAddress(customerId, address!.id, data),
    onSuccess: () => {
      toast.success("Address was successfully updated.")
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

    if (!addressName.trim()) {
      toast.error("Address name is required")
      return
    }

    if (!address1.trim()) {
      toast.error("Address is required")
      return
    }

    const payload: Record<string, unknown> = {
      address_name: addressName.trim(),
      address_1: address1.trim(),
      address_2: address2.trim() || undefined,
      city: city.trim() || undefined,
      country_code: countryCode.toLowerCase(),
      province: province.trim() || undefined,
      postal_code: postalCode.trim() || undefined,
      company: company.trim() || undefined,
      phone: phone.trim() || undefined,
    }

    if (isEditing) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <form onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
          <FocusModal.Header className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-x-2">
              <FocusModal.Close asChild>
                <Button size="small" variant="secondary" type="button" disabled={isPending}>
                  Cancel
                </Button>
              </FocusModal.Close>
              <Button size="small" variant="primary" type="submit" isLoading={isPending}>
                Save
              </Button>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="flex flex-1 flex-col items-center overflow-y-auto py-16 px-4">
            <div className="flex w-full max-w-[720px] flex-col gap-y-8">
              <div>
                <FocusModal.Title asChild>
                  <Heading level="h1">
                    {isEditing ? "Edit Address" : "Create Address"}
                  </Heading>
                </FocusModal.Title>
                <FocusModal.Description asChild>
                  <Text size="small" className="text-ui-fg-subtle">
                    {isEditing
                      ? "Update the customer's address details."
                      : "Create a new address for the customer."}
                  </Text>
                </FocusModal.Description>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-y-2 col-span-2 sm:col-span-1">
                  <Label size="small" weight="plus">
                    Address name
                  </Label>
                  <Input
                    size="small"
                    autoComplete="address_name"
                    placeholder="Home, Office, etc."
                    value={addressName}
                    onChange={(e) => setAddressName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-y-2 col-span-2 sm:col-span-1">
                  <Label size="small" weight="plus">
                    Address
                  </Label>
                  <Input
                    size="small"
                    autoComplete="address_1"
                    placeholder="123 Main St"
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-y-2 col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between">
                    <Label size="small" weight="plus">
                      Address 2
                    </Label>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Optional
                    </Text>
                  </div>
                  <Input
                    size="small"
                    autoComplete="address_2"
                    placeholder="Apt 4B"
                    value={address2}
                    onChange={(e) => setAddress2(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <div className="flex items-center justify-between">
                    <Label size="small" weight="plus">
                      Postal code
                    </Label>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Optional
                    </Text>
                  </div>
                  <Input
                    size="small"
                    autoComplete="postal_code"
                    placeholder="90210"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <div className="flex items-center justify-between">
                    <Label size="small" weight="plus">
                      City
                    </Label>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Optional
                    </Text>
                  </div>
                  <Input
                    size="small"
                    autoComplete="city"
                    placeholder="Los Angeles"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Country
                  </Label>
                  <CountrySelect
                    value={countryCode}
                    onChange={setCountryCode}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <div className="flex items-center justify-between">
                    <Label size="small" weight="plus">
                      State
                    </Label>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Optional
                    </Text>
                  </div>
                  <Input
                    size="small"
                    autoComplete="province"
                    placeholder="California"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <div className="flex items-center justify-between">
                    <Label size="small" weight="plus">
                      Company
                    </Label>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Optional
                    </Text>
                  </div>
                  <Input
                    size="small"
                    autoComplete="company"
                    placeholder="Acme Corp"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <div className="flex items-center justify-between">
                    <Label size="small" weight="plus">
                      Phone
                    </Label>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Optional
                    </Text>
                  </div>
                  <Input
                    size="small"
                    type="tel"
                    autoComplete="phone"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </FocusModal.Body>
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}
