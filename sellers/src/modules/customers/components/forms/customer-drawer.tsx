"use client"

import {
  updateVendorCustomer,
  type VendorCustomer,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  Tooltip,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type CustomerDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: VendorCustomer | null
  onSuccess?: () => void
}

export const CustomerDrawer = ({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: CustomerDrawerProps) => {
  const queryClient = useQueryClient()

  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [companyName, setCompanyName] = useState("")

  useEffect(() => {
    if (customer) {
      setEmail(customer.email || "")
      setFirstName(customer.first_name || "")
      setLastName(customer.last_name || "")
      setPhone(customer.phone || "")
      setCompanyName(customer.company_name || "")
    } else {
      setEmail("")
      setFirstName("")
      setLastName("")
      setPhone("")
      setCompanyName("")
    }
  }, [customer, open])

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      updateVendorCustomer(customer!.id, data),
    onSuccess: (data) => {
      const updated = data.customer
      toast.success(`Customer ${updated.email} was successfully updated.`)
      queryClient.invalidateQueries({ queryKey: ["vendor-customers"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer", customer?.id],
      })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update customer")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!customer) return

    updateMutation.mutate({
      email: customer.has_account ? undefined : email.trim(),
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      phone: phone.trim() || null,
      company_name: companyName.trim() || null,
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between overflow-hidden">
          <Drawer.Header>
            <Drawer.Title asChild>
              <Heading level="h2">Edit Customer</Heading>
            </Drawer.Title>
            <Drawer.Description className="sr-only">
              Edit customer details
            </Drawer.Description>
          </Drawer.Header>

          <Drawer.Body className="flex flex-1 flex-col gap-y-4 p-6 overflow-y-auto">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Email
              </Label>
              {customer?.has_account ? (
                <Tooltip
                  content="The email address cannot be changed for registered customers."
                  side="top"
                >
                  <div>
                    <Input
                      type="email"
                      value={email}
                      disabled
                      className="cursor-not-allowed opacity-60"
                    />
                  </div>
                </Tooltip>
              ) : (
                <Input
                  type="email"
                  placeholder="customer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              )}
            </div>

            <div className="flex flex-col gap-y-2">
              <div className="flex items-center justify-between">
                <Label size="small" weight="plus">
                  First name
                </Label>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Optional
                </Text>
              </div>
              <Input
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <div className="flex items-center justify-between">
                <Label size="small" weight="plus">
                  Last name
                </Label>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Optional
                </Text>
              </div>
              <Input
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
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
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
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
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </Drawer.Body>

          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Drawer.Close asChild>
              <Button
                type="button"
                variant="secondary"
                size="small"
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
            </Drawer.Close>
            <Button
              type="submit"
              size="small"
              variant="primary"
              isLoading={updateMutation.isPending}
            >
              Save
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
