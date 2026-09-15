"use client"

import {
  deleteVendorCustomerGroup,
  getVendorCustomerGroup,
  type VendorCustomerGroup,
} from "@lib/data/vendor-client"
import { ActionMenu } from "@modules/common"
import { ArrowLeft, PencilSquare, Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  Heading,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
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
      toast.success(`Customer group ${group?.name || "group"} was successfully deleted.`)
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
      router.push("/customers/groups")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete customer group")
    },
  })

  const handleDelete = async () => {
    if (!group) return

    const name = group.name ?? ""
    const confirmed = await prompt({
      title: "Delete Customer Group",
      description: `You are about to delete the customer group ${name}. This action cannot be undone.`,
      verificationInstruction: "Type to confirm",
      verificationText: name,
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

  const customerCount = group.customers_count ?? group.customers?.length ?? 0

  return (
    <>
      <div className="flex flex-col gap-y-3">
        {/* CustomerGroupGeneralSection */}
        <Container className="divide-y p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <Heading level="h1">{group.name}</Heading>
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "Edit",
                      icon: <PencilSquare className="h-4 w-4" />,
                      onClick: () => setIsEditOpen(true),
                    },
                    {
                      label: "Delete",
                      icon: <Trash className="h-4 w-4" />,
                      onClick: handleDelete,
                    },
                  ],
                },
              ]}
            />
          </div>

          <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
            <Text size="small" leading="compact" weight="plus">
              Customers
            </Text>
            <Text size="small" leading="compact">
              {customerCount || "-"}
            </Text>
          </div>
        </Container>

        {/* CustomerGroupCustomerSection */}
        <GroupMembersSection group={group} />

        {/* MetadataSection */}
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
