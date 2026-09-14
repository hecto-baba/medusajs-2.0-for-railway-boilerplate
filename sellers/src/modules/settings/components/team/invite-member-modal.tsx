"use client"

import {
  inviteVendorMember,
  type VendorTeamMember,
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
import { useState } from "react"

type InviteMemberModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const InviteMemberModal = ({
  open,
  onOpenChange,
  onSuccess,
}: InviteMemberModalProps) => {
  const queryClient = useQueryClient()

  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; first_name?: string; last_name?: string }) =>
      inviteVendorMember(data),
    onSuccess: () => {
      toast.success("Team member invited successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-team"] })
      onOpenChange(false)
      setEmail("")
      setFirstName("")
      setLastName("")
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to invite team member")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error("Email is required")
      return
    }

    inviteMutation.mutate({
      email: email.trim(),
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
    })
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Invite Team Member</Heading>
            </FocusModal.Title>
            <FocusModal.Description className="text-ui-fg-subtle text-sm">
              Add a new staff member or administrator to your vendor store.
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
              isLoading={inviteMutation.isPending}
              onClick={handleSubmit}
            >
              Send Invite
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 flex-col gap-y-4 p-6 max-w-lg mx-auto w-full">
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Email Address <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              type="email"
              placeholder="member@company.com"
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
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Last Name
              </Label>
              <Input
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
