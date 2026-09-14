"use client"

import {
  updateVendorMember,
  type VendorTeamMember,
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

type MemberEditDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  member?: VendorTeamMember | null
  onSuccess?: () => void
}

export const MemberEditDrawer = ({
  open,
  onOpenChange,
  member,
  onSuccess,
}: MemberEditDrawerProps) => {
  const queryClient = useQueryClient()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  useEffect(() => {
    if (member) {
      setFirstName(member.first_name || "")
      setLastName(member.last_name || "")
    } else {
      setFirstName("")
      setLastName("")
    }
  }, [member, open])

  const updateMutation = useMutation({
    mutationFn: (data: { first_name?: string; last_name?: string }) =>
      updateVendorMember(member!.id, data),
    onSuccess: () => {
      toast.success("Team member updated successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-team"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update member")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    updateMutation.mutate({
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-md">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Edit Team Member</Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            Update member name details.
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between">
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Email
              </Label>
              <Input value={member?.email || ""} disabled className="bg-ui-bg-subtle" />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                First Name
              </Label>
              <Input
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Last Name
              </Label>
              <Input
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
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
