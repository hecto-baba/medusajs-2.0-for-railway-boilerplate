"use client"

import {
  createVendorInvite,
  listVendorInvites,
  resendVendorInvite,
  revokeVendorInvite,
  type VendorInvite,
} from "@lib/data/vendor-client"
import { ArrowPath, Check, SquareTwoStack, EllipsisHorizontal, Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  DropdownMenu,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Query pending invites
  const { data: invitesData, isLoading: isInvitesLoading } = useQuery({
    queryKey: ["vendor-invites"],
    queryFn: () => listVendorInvites(),
    enabled: open,
  })

  const invites = invitesData?.invites ?? []

  // Create invite mutation
  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; first_name?: string; last_name?: string }) =>
      createVendorInvite(data),
    onSuccess: () => {
      toast.success("Invitation sent successfully.")
      queryClient.invalidateQueries({ queryKey: ["vendor-invites"] })
      setEmail("")
      setFirstName("")
      setLastName("")
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to invite team member.")
    },
  })

  // Resend invite mutation
  const resendMutation = useMutation({
    mutationFn: (id: string) => resendVendorInvite(id),
    onSuccess: () => {
      toast.success("Invitation resent successfully.")
      queryClient.invalidateQueries({ queryKey: ["vendor-invites"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to resend invitation.")
    },
  })

  // Revoke invite mutation
  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeVendorInvite(id),
    onSuccess: () => {
      toast.success("Invitation revoked.")
      queryClient.invalidateQueries({ queryKey: ["vendor-invites"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to revoke invitation.")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error("Email is required.")
      return
    }

    inviteMutation.mutate({
      email: email.trim(),
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
    })
  }

  const handleCopyLink = (invite: VendorInvite) => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const inviteUrl = `${origin}/invite?token=${invite.token}`
    navigator.clipboard.writeText(inviteUrl)
    setCopiedId(invite.id)
    toast.success("Invite link copied to clipboard.")
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col max-h-[90vh]">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Invite Team Member</Heading>
            </FocusModal.Title>
            <FocusModal.Description className="text-ui-fg-subtle text-sm">
              Send invitations to team members and manage pending invitations.
            </FocusModal.Description>
          </div>
          <div className="flex items-center gap-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex-1 overflow-y-auto p-6 flex flex-col gap-y-8 max-w-2xl mx-auto w-full">
          {/* Invite Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-y-4 rounded-lg border border-ui-border-base p-5 bg-ui-bg-subtle/50">
            <div className="flex items-center justify-between">
              <div>
                <Text size="small" weight="plus" className="text-ui-fg-base">
                  Send an Invitation
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  The user will receive instructions to access your seller store.
                </Text>
              </div>
              <Button
                type="submit"
                size="small"
                variant="primary"
                isLoading={inviteMutation.isPending}
              >
                Send Invite
              </Button>
            </div>

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
          </form>

          {/* Pending Invites Section */}
          <div className="flex flex-col gap-y-3">
            <div>
              <Heading level="h3" className="text-base font-medium text-ui-fg-base">
                Pending Invites
              </Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Active invitations sent to prospective team members.
              </Text>
            </div>

            <div className="overflow-x-auto rounded-lg border border-ui-border-base">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell className="w-2/5">Member</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Expires</Table.HeaderCell>
                    <Table.HeaderCell className="text-right"></Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {isInvitesLoading ? (
                    <Table.Row>
                      <td colSpan={4} className="h-24 text-center text-ui-fg-subtle">
                        <Text size="small">Loading pending invites...</Text>
                      </td>
                    </Table.Row>
                  ) : invites.length === 0 ? (
                    <Table.Row>
                      <td colSpan={4} className="h-24 text-center text-ui-fg-subtle">
                        <Text size="small">No pending invitations.</Text>
                      </td>
                    </Table.Row>
                  ) : (
                    invites.map((inv) => {
                      const name = [inv.first_name, inv.last_name]
                        .filter(Boolean)
                        .join(" ")
                      const isExpired = inv.status === "expired"
                      const expiresFormatted = inv.expires_at
                        ? new Date(inv.expires_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "-"

                      return (
                        <Table.Row key={inv.id}>
                          <Table.Cell>
                            <div className="flex flex-col">
                              {name && (
                                <Text size="small" weight="plus" className="text-ui-fg-base">
                                  {name}
                                </Text>
                              )}
                              <Text size="small" className="text-ui-fg-subtle font-mono">
                                {inv.email}
                              </Text>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            {isExpired ? (
                              <Badge size="2xsmall" color="orange">
                                Expired
                              </Badge>
                            ) : (
                              <Badge size="2xsmall" color="blue">
                                Pending
                              </Badge>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="small" className="text-ui-fg-subtle">
                              {expiresFormatted}
                            </Text>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <DropdownMenu>
                              <DropdownMenu.Trigger asChild>
                                <IconButton size="small" variant="transparent">
                                  <EllipsisHorizontal className="h-4 w-4" />
                                </IconButton>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Content>
                                <DropdownMenu.Item
                                  className="gap-x-2"
                                  onClick={() => handleCopyLink(inv)}
                                >
                                  {copiedId === inv.id ? (
                                    <Check className="h-4 w-4 text-ui-fg-interactive" />
                                  ) : (
                                    <SquareTwoStack className="h-4 w-4" />
                                  )}
                                  Copy invite link
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  className="gap-x-2"
                                  onClick={() => resendMutation.mutate(inv.id)}
                                >
                                  <ArrowPath className="h-4 w-4" />
                                  Resend invite
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator />
                                <DropdownMenu.Item
                                  className="gap-x-2 text-ui-fg-error"
                                  onClick={() => revokeMutation.mutate(inv.id)}
                                >
                                  <Trash className="h-4 w-4" />
                                  Revoke invite
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu>
                          </Table.Cell>
                        </Table.Row>
                      )
                    })
                  )}
                </Table.Body>
              </Table>
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
