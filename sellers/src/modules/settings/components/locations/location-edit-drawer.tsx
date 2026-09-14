"use client"

import {
  updateVendorStockLocation,
  type VendorStockLocation,
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

type LocationEditDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  location?: VendorStockLocation | null
  onSuccess?: () => void
}

export const LocationEditDrawer = ({
  open,
  onOpenChange,
  location,
  onSuccess,
}: LocationEditDrawerProps) => {
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [address1, setAddress1] = useState("")
  const [address2, setAddress2] = useState("")
  const [city, setCity] = useState("")
  const [countryCode, setCountryCode] = useState("us")
  const [postalCode, setPostalCode] = useState("")
  const [province, setProvince] = useState("")
  const [company, setCompany] = useState("")

  useEffect(() => {
    if (location) {
      setName(location.name || "")
      setAddress1(location.address?.address_1 || "")
      setAddress2(location.address?.address_2 || "")
      setCity(location.address?.city || "")
      setCountryCode(location.address?.country_code || "us")
      setPostalCode(location.address?.postal_code || "")
      setProvince(location.address?.province || "")
      setCompany(location.address?.company || "")
    }
  }, [location, open])

  const updateMutation = useMutation({
    mutationFn: () =>
      updateVendorStockLocation(location!.id, {
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
    onSuccess: () => {
      toast.success("Location updated successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-stock-locations"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-stock-location", location?.id] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update location")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Location name is required")
      return
    }
    updateMutation.mutate()
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-md">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Edit Location</Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            Update location name and address information.
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between overflow-y-auto">
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Location Name <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Address Line 1
              </Label>
              <Input
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Address Line 2
              </Label>
              <Input
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  City
                </Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Postal Code
                </Label>
                <Input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Province / State
                </Label>
                <Input
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Country (2 letters)
                </Label>
                <Input
                  maxLength={2}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toLowerCase())}
                />
              </div>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Company
              </Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </Drawer.Body>

          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
