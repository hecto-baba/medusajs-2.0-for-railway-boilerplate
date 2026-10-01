import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Badge,
  Button,
  Container,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  ArrowLeft,
  EllipsisHorizontal,
  Link as LinkIcon,
  LockClosedSolid,
  PencilSquare,
  Plus,
  Trash,
} from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"
import { EditCompanyDrawer } from "../components/edit-company-drawer"
import { ManageCustomerGroupModal } from "../components/manage-customer-group-modal"
import { ApprovalSettingsModal } from "../components/approval-settings-modal"

const CompanyDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [approvalOpen, setApprovalOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: () => sdk.client.fetch<any>(`/admin/companies/${id}`),
  })

  const { mutateAsync: deleteCompany } = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/companies/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Success", { description: "Company deleted successfully" })
      navigate("/b2b/companies")
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to delete company" })
    },
  })

  const company = data?.company

  if (isLoading) {
    return (
      <Container className="p-6">
        <Text>Loading company details...</Text>
      </Container>
    )
  }

  if (!company) {
    return (
      <Container className="p-6">
        <Text>Company not found.</Text>
      </Container>
    )
  }

  const currency = (company.currency_code || "EUR").toUpperCase()
  const initial = (company.name || "C").charAt(0).toLowerCase()
  const customerGroup = company.customer_group

  const handleDeleteCompany = () => {
    if (window.confirm(`Are you sure you want to permanently delete "${company.name}"?`)) {
      deleteCompany()
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center gap-x-2">
        <Button
          variant="secondary"
          size="small"
          onClick={() => navigate("/b2b/companies")}
        >
          <ArrowLeft className="mr-1" /> Back to Companies
        </Button>
      </div>

      {/* Top Overview Card matching Screenshot 5 */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ui-bg-subtle text-sm font-semibold text-ui-fg-subtle border">
              {initial}
            </div>
            <Heading level="h1" className="text-xl">
              {company.name}
            </Heading>
          </div>

          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton size="small" variant="transparent">
                <EllipsisHorizontal />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className="min-w-[200px]">
              <DropdownMenu.Item className="gap-x-2" onClick={() => setEditOpen(true)}>
                <PencilSquare className="text-ui-fg-subtle" />
                <span>Edit details</span>
              </DropdownMenu.Item>

              <DropdownMenu.Item className="gap-x-2" onClick={() => setGroupOpen(true)}>
                <LinkIcon className="text-ui-fg-subtle" />
                <span>Manage customer group</span>
              </DropdownMenu.Item>

              <DropdownMenu.Item className="gap-x-2" onClick={() => setApprovalOpen(true)}>
                <LockClosedSolid className="text-ui-fg-subtle" />
                <span>Approval settings</span>
              </DropdownMenu.Item>

              <DropdownMenu.Separator />

              <DropdownMenu.Item
                className="gap-x-2 text-ui-fg-error"
                onClick={handleDeleteCompany}
              >
                <Trash className="text-ui-fg-error" />
                <span>Delete</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>

        <div className="divide-y text-sm">
          <div className="grid grid-cols-2 px-6 py-3">
            <Text className="text-ui-fg-subtle">Phone</Text>
            <Text>{company.phone || "-"}</Text>
          </div>
          <div className="grid grid-cols-2 px-6 py-3">
            <Text className="text-ui-fg-subtle">Email</Text>
            <Text>{company.email || "-"}</Text>
          </div>
          <div className="grid grid-cols-2 px-6 py-3">
            <Text className="text-ui-fg-subtle">Address</Text>
            <Text>{company.address || "-"}</Text>
          </div>
          <div className="grid grid-cols-2 px-6 py-3">
            <Text className="text-ui-fg-subtle">City</Text>
            <Text>{company.city || "-"}</Text>
          </div>
          <div className="grid grid-cols-2 px-6 py-3">
            <Text className="text-ui-fg-subtle">State</Text>
            <Text>{company.state || "-"}</Text>
          </div>
          <div className="grid grid-cols-2 px-6 py-3">
            <Text className="text-ui-fg-subtle">Currency</Text>
            <Text>{currency}</Text>
          </div>
          <div className="grid grid-cols-2 px-6 py-3">
            <Text className="text-ui-fg-subtle">Customer Group</Text>
            <Text>{customerGroup?.name || "-"}</Text>
          </div>
          <div className="grid grid-cols-2 px-6 py-3">
            <Text className="text-ui-fg-subtle">Approval Settings</Text>
            <div>
              <Badge color="grey" size="xsmall">
                {company.approval_settings?.requires_approval
                  ? "Spending limit policy"
                  : "No approval required"}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 px-6 py-3">
            <Text className="text-ui-fg-subtle">Team Management</Text>
            <div>
              <Badge color="grey" size="xsmall" className="gap-x-1">
                <LockClosedSolid className="w-3 h-3 text-ui-fg-subtle" /> Storefront Managed (Confidential)
              </Badge>
            </div>
          </div>
        </div>
      </Container>

      {/* Privacy Notice: Team members are buyer confidential */}
      <Container className="p-6">
        <div className="flex items-start gap-x-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ui-bg-subtle text-ui-fg-subtle border flex-shrink-0">
            <LockClosedSolid />
          </div>
          <div className="flex flex-col gap-y-1">
            <Heading level="h2" className="text-base font-semibold">
              Employee Directory & Team Management (Buyer Confidential)
            </Heading>
            <Text className="text-ui-fg-subtle text-sm">
              Employee rosters, invitations, and individual spending limits are confidential to <strong>{company.name}</strong> and are strictly managed by company administrators via the Buyer Storefront portal (<code className="font-mono text-xs bg-ui-bg-subtle px-1 py-0.5 rounded">/account/company</code>).
            </Text>
          </div>
        </div>
      </Container>

      {/* Edit Company Drawer */}
      <EditCompanyDrawer
        company={company}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Manage Customer Group Modal */}
      <ManageCustomerGroupModal
        company={company}
        open={groupOpen}
        onOpenChange={setGroupOpen}
      />

      {/* Approval Settings Modal */}
      <ApprovalSettingsModal
        company={company}
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
      />
    </div>
  )
}

export default CompanyDetailPage
