"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import {
  ArrowLeft,
  EllipsisHorizontal,
  LockClosedSolid,
  PencilSquare,
  Trash,
  Link as LinkIcon,
} from "@medusajs/icons"
import Link from "next/link"
import {
  getVendorCompany,
  updateVendorCompany,
  deleteVendorCompany,
  VendorCompany,
} from "@lib/data/vendor-client"

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)

  // Edit form state
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formAddress, setFormAddress] = useState("")
  const [formCity, setFormCity] = useState("")
  const [formState, setFormState] = useState("")
  const [formPostalCode, setFormPostalCode] = useState("")
  const [formCountryCode, setFormCountryCode] = useState("")
  const [formCurrencyCode, setFormCurrencyCode] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-company", id],
    queryFn: () => getVendorCompany(id),
    enabled: !!id,
  })

  const { mutateAsync: updateCompany, isPending: isUpdating } = useMutation({
    mutationFn: (body: Partial<VendorCompany>) => updateVendorCompany(id, body),
    onSuccess: () => {
      toast.success("Success", { description: "Company updated successfully" })
      setEditOpen(false)
      queryClient.invalidateQueries({ queryKey: ["vendor-company", id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-companies"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to update company" })
    },
  })

  const { mutateAsync: deleteCompanyFn } = useMutation({
    mutationFn: () => deleteVendorCompany(id),
    onSuccess: () => {
      toast.success("Success", { description: "Company deleted successfully" })
      window.location.href = "/b2b/companies"
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
      deleteCompanyFn()
    }
  }

  const openEditDrawer = () => {
    setFormName(company.name)
    setFormEmail(company.email)
    setFormPhone(company.phone || "")
    setFormAddress(company.address || "")
    setFormCity(company.city || "")
    setFormState(company.state || "")
    setFormPostalCode(company.postal_code || "")
    setFormCountryCode(company.country_code || "")
    setFormCurrencyCode(company.currency_code || "")
    setEditOpen(true)
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center gap-x-2">
        <Link href="/b2b/companies">
          <Button variant="secondary" size="small">
            <ArrowLeft className="mr-1" /> Back to Companies
          </Button>
        </Link>
      </div>

      {/* Top Overview Card */}
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
              <DropdownMenu.Item className="gap-x-2" onClick={openEditDrawer}>
                <PencilSquare className="text-ui-fg-subtle" />
                <span>Edit details</span>
              </DropdownMenu.Item>

              <DropdownMenu.Item className="gap-x-2">
                <LinkIcon className="text-ui-fg-subtle" />
                <span>Manage customer group</span>
              </DropdownMenu.Item>

              <DropdownMenu.Item className="gap-x-2">
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
      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Edit Company</Drawer.Title>
          </Drawer.Header>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              updateCompany({
                name: formName.trim(),
                email: formEmail.trim(),
                phone: formPhone.trim() || null,
                address: formAddress.trim() || null,
                city: formCity.trim() || null,
                state: formState.trim() || null,
                postal_code: formPostalCode.trim() || null,
                country_code: formCountryCode.toLowerCase(),
                currency_code: formCurrencyCode.toLowerCase(),
              })
            }}
            className="flex flex-col gap-y-4 p-6 overflow-y-auto max-h-[calc(100vh-180px)]"
          >
            <div>
              <Label className="text-xs font-semibold">Company Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs font-semibold">Corporate Email *</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs font-semibold">Phone Number</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Street Address</Label>
              <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">City</Label>
                <Input value={formCity} onChange={(e) => setFormCity(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold">State</Label>
                <Input value={formState} onChange={(e) => setFormState(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Country Code</Label>
                <Input
                  value={formCountryCode}
                  onChange={(e) => setFormCountryCode(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Currency</Label>
                <Input
                  value={formCurrencyCode}
                  onChange={(e) => setFormCurrencyCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
              <Button type="button" variant="secondary" size="small" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="small" isLoading={isUpdating}>
                Save Changes
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}
