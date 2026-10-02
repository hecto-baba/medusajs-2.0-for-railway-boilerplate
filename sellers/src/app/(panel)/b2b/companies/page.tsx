"use client"

import { useState } from "react"
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
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  BuildingStorefront,
  EllipsisHorizontal,
  PencilSquare,
  Plus,
  Trash,
  User,
  ArrowLeft,
} from "@medusajs/icons"
import Link from "next/link"
import {
  listVendorCompanies,
  createVendorCompany,
  updateVendorCompany,
  deleteVendorCompany,
  VendorCompany,
} from "@lib/data/vendor-client"

export default function CompaniesPage() {
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 15

  // Form & Drawer State
  const [createOpen, setCreateOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<VendorCompany | null>(null)

  // Company Form inputs
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [countryCode, setCountryCode] = useState("US")
  const [currencyCode, setCurrencyCode] = useState("USD")

  // Fetch Companies
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-companies", currentPage],
    queryFn: () =>
      listVendorCompanies({
        limit: pageSize,
        offset: currentPage * pageSize,
      }),
  })

  const companies = data?.companies || []
  const count = data?.count || 0

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (body: Partial<VendorCompany>) => createVendorCompany(body),
    onSuccess: () => {
      toast.success("Success", { description: "Company created successfully" })
      setCreateOpen(false)
      setName("")
      setEmail("")
      setPhone("")
      setAddress("")
      setCity("")
      queryClient.invalidateQueries({ queryKey: ["vendor-companies"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to create company" })
    },
  })

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<VendorCompany> }) =>
      updateVendorCompany(id, body),
    onSuccess: () => {
      toast.success("Success", { description: "Company updated successfully" })
      setEditCompany(null)
      queryClient.invalidateQueries({ queryKey: ["vendor-companies"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to update company" })
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorCompany(id),
    onSuccess: () => {
      toast.success("Success", { description: "Company deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["vendor-companies"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to delete company" })
    },
  })

  const openEditDrawer = (comp: VendorCompany) => {
    setEditCompany(comp)
    setName(comp.name)
    setEmail(comp.email)
    setPhone(comp.phone || "")
    setAddress(comp.address || "")
    setCity(comp.city || "")
    setCountryCode(comp.country_code || "US")
    setCurrencyCode(comp.currency_code || "USD")
  }

  return (
    <div className="flex flex-col gap-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/b2b"
            className="text-xs font-semibold text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to B2B Overview
          </Link>
          <Heading level="h1" className="text-2xl font-bold flex items-center gap-2">
            <BuildingStorefront className="w-6 h-6 text-ui-fg-base" />
            B2B Companies
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-0.5">
            Manage corporate client accounts, company addresses, employee rosters, and wholesale pricing.
          </Text>
        </div>

        <Button
          size="small"
          variant="primary"
          onClick={() => {
            setName("")
            setEmail("")
            setPhone("")
            setAddress("")
            setCity("")
            setCreateOpen(true)
          }}
          className="flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Create Company
        </Button>
      </div>

      {/* Companies Table */}
      <Container className="p-0 overflow-hidden divide-y divide-ui-border-base">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Company Name</Table.HeaderCell>
              <Table.HeaderCell>Contact Email</Table.HeaderCell>
              <Table.HeaderCell>Phone</Table.HeaderCell>
              <Table.HeaderCell>Location</Table.HeaderCell>
              <Table.HeaderCell>Currency</Table.HeaderCell>
              <Table.HeaderCell>Employees</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <td colSpan={7} className="text-center py-10 text-ui-fg-subtle">
                  Loading companies...
                </td>
              </Table.Row>
            ) : companies.length === 0 ? (
              <Table.Row>
                <td colSpan={7} className="text-center py-12">
                  <BuildingStorefront className="w-8 h-8 text-ui-fg-muted mx-auto mb-2 opacity-50" />
                  <Text className="font-medium text-ui-fg-base">No corporate companies created</Text>
                  <Text size="small" className="text-ui-fg-subtle mt-1 max-w-sm mx-auto">
                    Create your first B2B client company account to assign wholesale custom pricing and manage purchase orders.
                  </Text>
                  <Button
                    size="small"
                    variant="secondary"
                    className="mt-4"
                    onClick={() => setCreateOpen(true)}
                  >
                    Create First Company
                  </Button>
                </td>
              </Table.Row>
            ) : (
              companies.map((company) => (
                <Table.Row key={company.id} className="hover:bg-ui-bg-subtle/50 transition-colors">
                  <Table.Cell className="font-medium">
                    <Link
                      href={`/b2b/companies/${company.id}`}
                      className="font-semibold text-ui-fg-base hover:underline flex items-center gap-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-ui-bg-subtle border flex items-center justify-center text-xs font-bold text-ui-fg-subtle">
                        {company.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{company.name}</span>
                    </Link>
                  </Table.Cell>
                  <Table.Cell className="text-sm font-mono text-ui-fg-subtle">
                    {company.email}
                  </Table.Cell>
                  <Table.Cell className="text-sm text-ui-fg-subtle">
                    {company.phone || "-"}
                  </Table.Cell>
                  <Table.Cell className="text-sm text-ui-fg-subtle">
                    {company.city ? `${company.city}, ${company.country_code || ""}` : company.country_code || "-"}
                  </Table.Cell>
                  <Table.Cell className="text-xs font-mono">
                    <Badge color="grey" size="xsmall">
                      {company.currency_code?.toUpperCase()}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-sm">
                    {company.employees?.length || 0} employees
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <DropdownMenu>
                      <DropdownMenu.Trigger asChild>
                        <IconButton size="small" variant="transparent">
                          <EllipsisHorizontal />
                        </IconButton>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content className="min-w-[150px]">
                        <DropdownMenu.Item asChild>
                          <Link href={`/b2b/companies/${company.id}`} className="gap-x-2">
                            <User className="w-4 h-4 text-ui-fg-subtle" />
                            <span>View Roster</span>
                          </Link>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="gap-x-2"
                          onClick={() => openEditDrawer(company)}
                        >
                          <PencilSquare className="w-4 h-4 text-ui-fg-subtle" />
                          <span>Edit Details</span>
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          className="gap-x-2 text-rose-500 hover:text-rose-600"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${company.name}"?`)) {
                              deleteMutation.mutate(company.id)
                            }
                          }}
                        >
                          <Trash className="w-4 h-4" />
                          <span>Delete</span>
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Container>

      {/* Create Company Drawer */}
      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <Drawer.Content className="max-w-xl">
          <Drawer.Header>
            <Drawer.Title>Create Corporate Company</Drawer.Title>
            <Drawer.Description>
              Add a new business profile with corporate billing and contact information.
            </Drawer.Description>
          </Drawer.Header>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate({
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim() || undefined,
                address: address.trim() || undefined,
                city: city.trim() || undefined,
                country_code: countryCode.toLowerCase(),
                currency_code: currencyCode.toLowerCase(),
              })
            }}
            className="flex flex-col gap-y-4 p-6 overflow-y-auto max-h-[calc(100vh-180px)]"
          >
            <div>
              <Label className="text-xs font-semibold">Company Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Industrial Corp"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Corporate Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="procurement@acme.com"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 800-555-0100"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Street Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="742 Evergreen Terrace, Suite 500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">City</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="New York"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Country Code</Label>
                <Input
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  placeholder="US"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Trading Currency</Label>
              <Input
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                placeholder="USD"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="small"
                isLoading={createMutation.isPending}
              >
                Create Company
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer>

      {/* Edit Company Drawer */}
      <Drawer open={!!editCompany} onOpenChange={(open) => !open && setEditCompany(null)}>
        <Drawer.Content className="max-w-xl">
          <Drawer.Header>
            <Drawer.Title>Edit Company</Drawer.Title>
            <Drawer.Description>
              Update corporate client profile and billing addresses.
            </Drawer.Description>
          </Drawer.Header>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!editCompany) return
              updateMutation.mutate({
                id: editCompany.id,
                body: {
                  name: name.trim(),
                  email: email.trim(),
                  phone: phone.trim() || null,
                  address: address.trim() || null,
                  city: city.trim() || null,
                  country_code: countryCode.toLowerCase(),
                  currency_code: currencyCode.toLowerCase(),
                },
              })
            }}
            className="flex flex-col gap-y-4 p-6 overflow-y-auto max-h-[calc(100vh-180px)]"
          >
            <div>
              <Label className="text-xs font-semibold">Company Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Corporate Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Street Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">City</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Country Code</Label>
                <Input
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Trading Currency</Label>
              <Input
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => setEditCompany(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="small"
                isLoading={updateMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}
