"use client"

import {
  deleteVendorCustomerGroup,
  getVendorCustomerGroup,
} from "@lib/data/vendor-client"
import { ActionMenu, SectionRow } from "@modules/common"
import { ArrowLeft, PencilSquare, Trash } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { MetadataSection } from "../detail/metadata-section"
import { GroupDrawer } from "./group-drawer"
import { GroupMembersSection } from "./group-members-section"

type CustomerGroupDetailProps = {
  id: string
}

export const CustomerGroupDetail = ({ id }: CustomerGroupDetailProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isEditOpen, setIsEditOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-customer-group", id],
    queryFn: () => getVendorCustomerGroup(id),
  })

  const group = data?.customer_group

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => deleteVendorCustomerGroup(groupId),
    onSuccess: () => {
      toast.success("Customer group deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
      router.push("/customers/groups")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete customer group")
    },
  })

  const handleDelete = async () => {
    if (!group) return

    const confirmed = await prompt({
      title: "Delete Customer Group",
      description: `Are you sure you want to delete "${group.name}"?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(group.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text size="small" className="text-ui-fg-subtle">
          Loading customer group...
        </Text>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-y-4">
        <Text size="small" className="text-ui-fg-error">
          Customer group not found or access denied.
        </Text>
        <Link href="/customers/groups">
          <Button variant="secondary" size="small">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Customer Groups
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-y-6 pb-12">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-3">
            <Link href="/customers/groups">
              <Button variant="secondary" size="small">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <Heading level="h1">{group.name}</Heading>
              <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                ID: {group.id}
              </Text>
            </div>
          </div>

          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Edit Group",
                    icon: <PencilSquare className="h-4 w-4" />,
                    onClick: () => setIsEditOpen(true),
                  },
                  {
                    label: "Delete Group",
                    icon: <Trash className="h-4 w-4" />,
                    onClick: handleDelete,
                  },
                ],
              },
            ]}
          />
        </div>

        {/* Group Details Card */}
        <Container className="p-6">
          <div className="border-b pb-4 mb-2">
            <Heading level="h2">Group Details</Heading>
          </div>
          <div className="flex flex-col divide-y">
            <SectionRow title="Group Name" value={group.name} />
            <SectionRow
              title="Total Members"
              value={
                <Badge size="small" color="blue">
                  {group.customers_count ?? group.customers?.length ?? 0} customers
                </Badge>
              }
            />
            <SectionRow
              title="Created Date"
              value={
                group.created_at
                  ? new Date(group.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "-"
              }
            />
          </div>
        </Container>

        {/* Members Management */}
        <GroupMembersSection group={group} />

        {/* Metadata */}
        <MetadataSection metadata={group.metadata} />
      </div>

      <GroupDrawer
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        group={group}
      />
    </>
  )
}
