import { useState } from "react"
import { Button, Drawer, Input, Label, Select, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

type CreateCompanyFormProps = {
  onSuccess: () => void
  onCancel: () => void
}

export const CreateCompanyForm = ({
  onSuccess,
  onCancel,
}: CreateCompanyFormProps) => {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [currencyCode, setCurrencyCode] = useState("eur")

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (payload: any) =>
      sdk.client.fetch("/admin/companies", {
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
        email,
        phone,
        address,
        city,
        state,
        currency_code: currencyCode,
      })
      toast.success("Success", { description: "Company created successfully" })
      queryClient.invalidateQueries({ queryKey: ["companies"] })
      onSuccess()
    } catch (error: any) {
      toast.error("Error", { description: error.message || "Failed to create company" })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
      <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-4 overflow-y-auto p-6">
        <div className="flex flex-col space-y-2">
          <Label size="small" weight="plus">Company Name *</Label>
          <Input
            placeholder="e.g. Acme Global Logistics Ltd"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col space-y-2">
          <Label size="small" weight="plus">Company Email *</Label>
          <Input
            type="email"
            placeholder="contact@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col space-y-2">
          <Label size="small" weight="plus">Phone</Label>
          <Input
            placeholder="+1 234 567 8900"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="flex flex-col space-y-2">
          <Label size="small" weight="plus">Address</Label>
          <Input
            placeholder="123 Industrial Parkway"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col space-y-2">
            <Label size="small" weight="plus">City</Label>
            <Input
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="flex flex-col space-y-2">
            <Label size="small" weight="plus">State / Region</Label>
            <Input
              placeholder="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <Label size="small" weight="plus">Default Currency</Label>
          <Select value={currencyCode} onValueChange={setCurrencyCode}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="eur">EUR (€)</Select.Item>
              <Select.Item value="usd">USD ($)</Select.Item>
              <Select.Item value="gbp">GBP (£)</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </Drawer.Body>

      <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-4">
        <Button variant="secondary" size="small" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button size="small" type="submit" isLoading={isPending}>
          Create Company
        </Button>
      </Drawer.Footer>
    </form>
  )
}
