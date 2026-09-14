"use client"

import {
  deleteVendorMember,
  listVendorTeam,
  type VendorTeamMember,
} from "@lib/data/vendor-client"
import { PencilSquare, PlusMini, Trash, User } from "@medusajs/icons"
import {
  Avatar,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { InviteMemberModal } from "./invite-member-modal"
import { MemberEditDrawer } from "./member-edit-drawer"

const columnHelper = createDataTableColumnHelper<VendorTeamMember>()

export const TeamTable = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<VendorTeamMember | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-team", limit, offset],
    queryFn: () => listVendorTeam({ limit, offset }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: removeMember } = useMutation({
    mutationFn: (id: string) => deleteVendorMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-team"] })
    },
  })

  const handleDelete = async (member: VendorTeamMember) => {
    const memberName =
      member.first_name || member.last_name
        ? `${member.first_name || ""} ${member.last_name || ""}`.trim()
        : member.email

    const confirmed = await prompt({
      title: "Remove team member",
      description: `Are you sure you want to remove "${memberName}" from your store team? They will immediately lose access.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    try {
      await removeMember(member.id)
      toast.success(`"${memberName}" was removed.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove the team member."
      )
    }
  }

  const columns = [
    columnHelper.accessor("first_name", {
      header: "Member",
      cell: ({ row }) => {
        const member = row.original
        const name =
          member.first_name || member.last_name
            ? `${member.first_name || ""} ${member.last_name || ""}`.trim()
            : "Team Member"
        const initials =
          (member.first_name?.[0] || "") + (member.last_name?.[0] || "") ||
          member.email?.[0]?.toUpperCase() ||
          "U"

        return (
          <div className="flex items-center gap-x-3">
            <Avatar fallback={initials} size="small" />
            <div className="flex flex-col">
              <Text size="small" weight="plus" className="text-ui-fg-base">
                {name}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {member.email}
              </Text>
            </div>
          </div>
        )
      },
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: ({ row }) => (
        <Text size="small" className="text-ui-fg-subtle">
          {row.original.email}
        </Text>
      ),
    }),
    columnHelper.accessor("created_at", {
      header: "Joined",
      cell: ({ row }) => {
        const date = row.original.created_at
          ? new Date(row.original.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "-"
        return (
          <Text size="small" className="text-ui-fg-subtle">
            {date}
          </Text>
        )
      },
    }),
    columnHelper.action({
      actions: (ctx) => [
        {
          label: "Edit",
          icon: <PencilSquare />,
          onClick: () => {
            setSelectedMember(ctx.row.original)
            setEditOpen(true)
          },
        },
        {
          label: "Remove",
          icon: <Trash />,
          onClick: () => handleDelete(ctx.row.original),
        },
      ],
    }),
  ]

  const table = useDataTable({
    columns,
    data: data?.members ?? [],
    rowCount: data?.count ?? 0,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between gap-x-2 px-6 py-4">
          <div>
            <Heading level="h2">Team Members</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Manage your store administrators and team members.
            </Text>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setInviteOpen(true)}
          >
            <PlusMini />
            Invite Member
          </Button>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>

      <InviteMemberModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />

      <MemberEditDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        member={selectedMember}
      />
    </Container>
  )
}
