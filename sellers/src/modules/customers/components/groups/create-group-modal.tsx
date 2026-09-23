"use client"

import {
  createVendorCustomerGroup,
  type VendorCustomerGroup,
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

type CreateGroupModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (group: VendorCustomerGroup) => void
}

export const CreateGroupModal = ({
  open,
  onOpenChange,
  onSuccess,
}: CreateGroupModalProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => createVendorCustomerGroup(data),
    onSuccess: (data) => {
      const created = data.customer_group
      toast.success(`Customer group ${created.name} was successfully created.`)
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
      setName("")
      onOpenChange(false)
      if (onSuccess) {
        onSuccess(created)
      } else {
        router.push(`/customers/groups/${created.id}`)
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create customer group")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Name is required")
      return
    }

    createMutation.mutate({ name: name.trim() })
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

          <FocusModal.Body className="flex flex-col items-center pt-[72px] px-4 overflow-y-auto">
            <div className="flex w-full max-w-[720px] flex-col gap-y-8">
              <div>
                <FocusModal.Title asChild>
                  <Heading level="h1">Create Customer Group</Heading>
                </FocusModal.Title>
                <FocusModal.Description asChild>
                  <Text size="small" className="text-ui-fg-subtle">
                    Create a new customer group to segment your customers.
                  </Text>
                </FocusModal.Description>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Name
                  </Label>
                  <Input
                    autoComplete="off"
                    placeholder="VIP, Wholesale, Retail..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
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
