import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  toast,
  useDataTable,
  Text,
} from "@medusajs/ui"
import {
  BuildingStorefront,
  EllipsisHorizontal,
  Eye,
  Link as LinkIcon,
  LockClosedSolid,
  PencilSquare,
  Trash,
} from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"
import { CreateCompanyForm } from "./components/create-company-form"
import { EditCompanyDrawer } from "./components/edit-company-drawer"
import { ManageCustomerGroupModal } from "./components/manage-customer-group-modal"
import { ApprovalSettingsModal } from "./components/approval-settings-modal"

export type Company = {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
  country_code?: string
  currency_code: string
  customer_group?: { id: string; name: string }
  employees?: any[]
}

type CompaniesResponse = {
  companies: Company[]
  count: number
  limit: number
  offset: number
}

const columnHelper = createDataTableColumnHelper<Company>()

const CompaniesPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<Company | null>(null)
  const [groupCompany, setGroupCompany] = useState<Company | null>(null)
  const [approvalCompany, setApprovalCompany] = useState<Company | null>(null)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 15 })

  const { data, isLoading } = useQuery<CompaniesResponse>({
    queryKey: ["companies", pagination],
    queryFn: () =>
      sdk.client.fetch("/admin/companies", {
        query: {
          limit: pagination.pageSize,
          offset: pagination.pageIndex * pagination.pageSize,
        },
      }),
  })

  const { mutateAsync: deleteCompany } = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/companies/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Success", { description: "Company deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["companies"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to delete company" })
    },
  })

  const handleDelete = async (company: Company) => {
    if (window.confirm(`Are you sure you want to delete "${company.name}"?`)) {
      await deleteCompany(company.id)
    }
  }

  const columns = [
    columnHelper.accessor("name", {
      header: "Name",
      enableSorting: true,
      cell: ({ row }) => {
        const company = row.original
        const initial = (company.name || "C").charAt(0).toUpperCase()
        return (
          <div className="flex items-center gap-x-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ui-bg-subtle text-xs font-semibold text-ui-fg-subtle border">
              {initial}
            </div>
            <Link
              to={`/companies/${company.id}`}
              className="font-medium text-ui-fg-base hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {company.name}
            </Link>
          </div>
        )
      },
    }),
    columnHelper.accessor("phone", {
      header: "Phone",
      cell: ({ getValue }) => getValue() || "-",
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: ({ getValue }) => getValue() || "-",
    }),
    columnHelper.accessor("address", {
      header: "Address",
      cell: ({ row }) => {
        const c = row.original
        const parts = [c.address, c.city, c.state, c.postal_code].filter(Boolean)
        return parts.length > 0 ? parts.join(", ") : "-"
      },
    }),
    columnHelper.display({
      id: "privacy_status",
      header: "Team Management",
      cell: () => (
        <Badge color="grey" size="xsmall" className="gap-x-1">
          <LockClosedSolid className="w-3 h-3 text-ui-fg-subtle" /> Storefront Managed
        </Badge>
      ),
    }),
    columnHelper.display({
      id: "customer_group",
      header: "Customer Group",
      cell: ({ row }) => {
        const group = row.original.customer_group
        return group?.name || "-"
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const company = row.original
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <IconButton size="small" variant="transparent">
                  <EllipsisHorizontal />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content className="min-w-[200px]">
                <DropdownMenu.Item
                  className="gap-x-2"
                  onClick={() => navigate(`/companies/${company.id}`)}
                >
                  <Eye className="text-ui-fg-subtle" />
                  <span>View company & team</span>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  className="gap-x-2"
                  onClick={() => setEditCompany(company)}
                >
                  <PencilSquare className="text-ui-fg-subtle" />
                  <span>Edit details</span>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  className="gap-x-2"
                  onClick={() => setGroupCompany(company)}
                >
                  <LinkIcon className="text-ui-fg-subtle" />
                  <span>Manage customer group</span>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  className="gap-x-2"
                  onClick={() => setApprovalCompany(company)}
                >
                  <LockClosedSolid className="text-ui-fg-subtle" />
                  <span>Approval settings</span>
                </DropdownMenu.Item>

                <DropdownMenu.Separator />

                <DropdownMenu.Item
                  className="gap-x-2 text-ui-fg-error"
                  onClick={() => handleDelete(company)}
                >
                  <Trash className="text-ui-fg-error" />
                  <span>Delete</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        )
      },
    }),
  ]

  const table = useDataTable({
    data: data?.companies || [],
    columns,
    count: data?.count || 0,
    enablePagination: true,
    getRowId: (row) => row.id,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    onRowClick: (_event, row) => {
      navigate(`/companies/${row.id}`)
    },
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between p-4">
          <Heading level="h2">Companies</Heading>
          <Drawer open={createOpen} onOpenChange={setCreateOpen}>
            <Drawer.Trigger asChild>
              <Button size="small" variant="primary">
                Create
              </Button>
            </Drawer.Trigger>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>Create Company</Drawer.Title>
              </Drawer.Header>
              <CreateCompanyForm
                onSuccess={() => setCreateOpen(false)}
                onCancel={() => setCreateOpen(false)}
              />
            </Drawer.Content>
          </Drawer>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>

      {/* Edit Company Drawer */}
      <EditCompanyDrawer
        company={editCompany}
        open={Boolean(editCompany)}
        onOpenChange={(open) => !open && setEditCompany(null)}
      />

      {/* Manage Customer Group Modal */}
      <ManageCustomerGroupModal
        company={groupCompany}
        open={Boolean(groupCompany)}
        onOpenChange={(open) => !open && setGroupCompany(null)}
      />

      {/* Approval Settings Modal */}
      <ApprovalSettingsModal
        company={approvalCompany}
        open={Boolean(approvalCompany)}
        onOpenChange={(open) => !open && setApprovalCompany(null)}
      />
    </Container>
  )
}

export default CompaniesPage
