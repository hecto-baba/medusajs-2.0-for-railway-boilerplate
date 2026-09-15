"use client"

import {
  createVendorCustomer,
  type VendorCustomer,
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
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"

type CreateCustomerModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (customer: VendorCustomer) => void
}

export const CreateCustomerModal = ({
  open,
  onOpenChange,
  onSuccess,
}: CreateCustomerModalProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [companyName, setCompanyName] = useState("")

  const resetForm = () => {
    setEmail("")
    setFirstName("")
    setLastName("")
    setPhone("")
    setCompanyName("")
  }

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createVendorCustomer(data),
    onSuccess: (data) => {
      const created = data.customer
      toast.success(`Customer ${created.email} was successfully created.`)
      queryClient.invalidateQueries({ queryKey: ["vendor-customers"] })
      resetForm()
      onOpenChange(false)
      if (onSuccess) {
        onSuccess(created)
      } else {
        router.push(`/customers/${created.id}`)
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create customer")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error("Email is required")
      return
    }

    createMutation.mutate({
      email: email.trim(),
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      company_name: companyName.trim() || undefined,
      phone: phone.trim() || undefined,
    })
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <form onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
          <FocusModal.Header className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-x-2">
              <FocusModal.Close asChild>
                <Button size="small" variant="secondary" type="button">
                  Cancel
                </Button>
              </FocusModal.Close>
              <Button
                size="small"
                variant="primary"
                type="submit"
                isLoading={createMutation.isPending}
              >
                Create
              </Button>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="flex flex-1 flex-col items-center overflow-y-auto py-16 px-4">
            <div className="flex w-full max-w-[720px] flex-col gap-y-8">
              <div>
                <FocusModal.Title asChild>
                  <Heading level="h1">Create Customer</Heading>
                </FocusModal.Title>
                <FocusModal.Description asChild>
                  <Text size="small" className="text-ui-fg-subtle">
                    Create a new customer and manage their details.
                  </Text>
                </FocusModal.Description>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    autoComplete="off"
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
                    autoComplete="off"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2 md:col-span-2">
                  <Label size="small" weight="plus">
                    Email
                  </Label>
                  <Input
                    type="email"
                    autoComplete="off"
                    placeholder="customer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
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
                    autoComplete="off"
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
                    autoComplete="off"
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
