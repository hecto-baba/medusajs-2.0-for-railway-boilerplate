import { useState, useEffect } from "react"
import { Button, Drawer, Input, Label, Select, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

type EditCompanyDrawerProps = {
  company: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const EditCompanyDrawer = ({
  company,
  open,
  onOpenChange,
}: EditCompanyDrawerProps) => {
  const queryClient = useQueryClient()
  const [name, setName] = useState(company?.name || "")
  const [phone, setPhone] = useState(company?.phone || "")
  const [email, setEmail] = useState(company?.email || "")
  const [address, setAddress] = useState(company?.address || "")
  const [city, setCity] = useState(company?.city || "")
  const [state, setState] = useState(company?.state || "")
  const [postalCode, setPostalCode] = useState(company?.postal_code || "")
  const [countryCode, setCountryCode] = useState(company?.country_code || "us")
  const [currencyCode, setCurrencyCode] = useState(company?.currency_code || "eur")
  const [logoUrl, setLogoUrl] = useState(company?.logo_url || "")

  useEffect(() => {
    if (company) {
      setName(company.name || "")
      setPhone(company.phone || "")
      setEmail(company.email || "")
      setAddress(company.address || "")
      setCity(company.city || "")
      setState(company.state || "")
      setPostalCode(company.postal_code || "")
      setCountryCode(company.country_code || "us")
      setCurrencyCode(company.currency_code || "eur")
      setLogoUrl(company.logo_url || "")
    }
  }, [company])

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (payload: any) =>
      sdk.client.fetch(`/admin/companies/${company?.id}`, {
        method: "POST",
        body: payload,
      }),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email) {
      toast.error("Validation Error", { description: "Name and Email are required" })
      return
    }

    try {
      await mutateAsync({
        name,
        phone,
        email,
        address,
        city,
        state,
        postal_code: postalCode,
        country_code: countryCode,
        currency_code: currencyCode,
        logo_url: logoUrl,
      })
      toast.success("Success", { description: "Company details updated successfully" })
      queryClient.invalidateQueries({ queryKey: ["companies"] })
      queryClient.invalidateQueries({ queryKey: ["company", company?.id] })
      onOpenChange(false)
    } catch (error: any) {
      toast.error("Error", { description: error.message || "Failed to update company" })
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-lg">
        <Drawer.Header>
          <Drawer.Title>Edit Company</Drawer.Title>
        </Drawer.Header>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-4 overflow-y-auto p-6">
            <div className="flex flex-col space-y-2">
              <Label size="small" weight="plus">Company Name *</Label>
              <Input
                placeholder="Company Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label size="small" weight="plus">Company Phone</Label>
              <Input
                placeholder="1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label size="small" weight="plus">Company Email *</Label>
              <Input
                type="email"
                placeholder="email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label size="small" weight="plus">Company Address</Label>
              <Input
                placeholder="Street address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label size="small" weight="plus">Company City</Label>
              <Input
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label size="small" weight="plus">Company State</Label>
              <Input
                placeholder="State / Province"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label size="small" weight="plus">Company Zip</Label>
              <Input
                placeholder="Postal / Zip Code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-2">
                <Label size="small" weight="plus">Company Country</Label>
                <Input
                  placeholder="US, GB, DE..."
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                />
              </div>

              <div className="flex flex-col space-y-2">
                <Label size="small" weight="plus">Currency</Label>
                <Select value={currencyCode} onValueChange={setCurrencyCode}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="eur">EUR (€)</Select.Item>
                    <Select.Item value="usd">USD ($)</Select.Item>
                    <Select.Item value="gbp">GBP (£)</Select.Item>
                    <Select.Item value="inr">INR (₹)</Select.Item>
                  </Select.Content>
                </Select>
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <Label size="small" weight="plus">Company Logo URL</Label>
              <Input
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
          </Drawer.Body>

          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-4">
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button size="small" type="submit" isLoading={isPending}>
              Save
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
