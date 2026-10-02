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
  Eye,
  LockClosedSolid,
  PencilSquare,
  Plus,
  Trash,
  Link as LinkIcon,
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
  const [state, setState] = useState("")
  const [postalCode, setPostalCode] = useState("")
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
  const totalPages = Math.ceil(count / pageSize)

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (body: Partial<VendorCompany>) => createVendorCompany(body),
    onSuccess: () => {
      toast.success("Success", { description: "Company created successfully" })
      setCreateOpen(false)
      resetForm()
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

  const resetForm = () => {
    setName("")
    setEmail("")
    setPhone("")
    setAddress("")
    setCity("")
    setState("")
    setPostalCode("")
  }

  const openEditDrawer = (comp: VendorCompany) => {
    setEditCompany(comp)
    setName(comp.name)
    setEmail(comp.email)
    setPhone(comp.phone || "")
    setAddress(comp.address || "")
    setCity(comp.city || "")
    setState(comp.state || "")
    setPostalCode(comp.postal_code || "")
    setCountryCode(comp.country_code || "US")
    setCurrencyCode(comp.currency_code || "USD")
  }

  const handleDelete = async (company: VendorCompany) => {
    if (window.confirm(`Are you sure you want to delete "${company.name}"?`)) {
      await deleteMutation.mutateAsync(company.id)
    }
  }

  return (
    <Container className="divide-y p-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4">
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
            <form
              onSubmit={(e) => {
                e.preventDefault()
                createMutation.mutate({
                  name: name.trim(),
                  email: email.trim(),
                  phone: phone.trim() || undefined,
                  address: address.trim() || undefined,
                  city: city.trim() || undefined,
                  state: state.trim() || undefined,
                  postal_code: postalCode.trim() || undefined,
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
      </div>

      {/* Table */}
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Phone</Table.HeaderCell>
            <Table.HeaderCell>Email</Table.HeaderCell>
            <Table.HeaderCell>Address</Table.HeaderCell>
            <Table.HeaderCell>Team Management</Table.HeaderCell>
            <Table.HeaderCell>Customer Group</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
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
              <td colSpan={7} className="py-12 text-center">
                <div className="flex flex-col items-center justify-center gap-y-2">
                  <BuildingStorefront className="text-ui-fg-muted" />
                  <Text weight="plus">No companies found</Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    Create your first B2B company account to manage wholesale pricing.
                  </Text>
                </div>
              </td>
            </Table.Row>
          ) : (
            companies.map((company) => {
              const initial = (company.name || "C").charAt(0).toUpperCase()
              const parts = [company.address, company.city, company.state, company.postal_code].filter(Boolean)
              const addressStr = parts.length > 0 ? parts.join(", ") : "-"

              return (
                <Table.Row
                  key={company.id}
                  className="cursor-pointer hover:bg-ui-bg-subtle/50 transition-colors"
                  onClick={() => window.location.href = `/b2b/companies/${company.id}`}
                >
                  <Table.Cell>
                    <div className="flex items-center gap-x-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ui-bg-subtle text-xs font-semibold text-ui-fg-subtle border">
                        {initial}
                      </div>
                      <Link
                        href={`/b2b/companies/${company.id}`}
                        className="font-medium text-ui-fg-base hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {company.name}
                      </Link>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{company.phone || "-"}</Table.Cell>
                  <Table.Cell>{company.email || "-"}</Table.Cell>
                  <Table.Cell>{addressStr}</Table.Cell>
                  <Table.Cell>
                    <Badge color="grey" size="xsmall" className="gap-x-1">
                      <LockClosedSolid className="w-3 h-3 text-ui-fg-subtle" /> Storefront Managed
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {company.customer_group?.name || "-"}
                  </Table.Cell>
                  <Table.Cell>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton size="small" variant="transparent">
                            <EllipsisHorizontal />
                          </IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content className="min-w-[200px]">
                          <DropdownMenu.Item asChild className="gap-x-2">
                            <Link href={`/b2b/companies/${company.id}`}>
                              <Eye className="text-ui-fg-subtle" />
                              <span>View company & team</span>
                            </Link>
                          </DropdownMenu.Item>

                          <DropdownMenu.Item
                            className="gap-x-2"
                            onClick={() => openEditDrawer(company)}
                          >
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
                            onClick={() => handleDelete(company)}
                          >
                            <Trash className="text-ui-fg-error" />
                            <span>Delete</span>
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )
            })
          )}
        </Table.Body>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, count)} of {count}
          </Text>
          <div className="flex items-center gap-x-2">
            <Button
              size="small"
              variant="secondary"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Edit Company Drawer */}
      <Drawer open={!!editCompany} onOpenChange={(open) => !open && setEditCompany(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Edit Company</Drawer.Title>
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
                  state: state.trim() || null,
                  postal_code: postalCode.trim() || null,
                  country_code: countryCode.toLowerCase(),
                  currency_code: currencyCode.toLowerCase(),
                },
              })
            }}
            className="flex flex-col gap-y-4 p-6 overflow-y-auto max-h-[calc(100vh-180px)]"
          >
            <div>
              <Label className="text-xs font-semibold">Company Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs font-semibold">Corporate Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs font-semibold">Phone Number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Street Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
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
    </Container>
  )
}
