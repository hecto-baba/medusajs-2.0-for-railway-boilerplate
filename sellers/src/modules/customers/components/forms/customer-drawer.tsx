"use client"

import {
  createVendorCustomer,
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
  const isEditing = Boolean(customer)
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

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createVendorCustomer(data),
    onSuccess: () => {
      toast.success("Customer created successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-customers"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create customer")
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      updateVendorCustomer(customer!.id, data),
    onSuccess: () => {
      toast.success("Customer updated successfully")
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

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error("Email is required")
      return
    }

    const payload: Record<string, unknown> = {
      email: email.trim(),
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      phone: phone.trim() || null,
      company_name: companyName.trim() || null,
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
              {isEditing ? "Edit Customer" : "Create Customer"}
            </Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            {isEditing
              ? "Update the customer's personal and contact information."
              : "Add a new customer to your store."}
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between">
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Email <span className="text-ui-fg-error">*</span>
              </Label>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                Phone Number
              </Label>
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Company Name
              </Label>
              <Input
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
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
              {isEditing ? "Save Changes" : "Create Customer"}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
