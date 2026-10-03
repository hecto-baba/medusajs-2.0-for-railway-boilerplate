"use client"

import {
  createVendorTaxRate,
  deleteVendorTaxRate,
  listVendorTaxRates,
  listVendorTaxRegions,
  updateVendorTaxRateById,
  type VendorTaxRate,
} from "@lib/data/vendor-client"
import { PencilSquare, PlusMini, Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

const QUERY_KEY = "vendor-tax-rates"

export const TaxRatesCard = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VendorTaxRate | null>(null)
  const [regionId, setRegionId] = useState("")
  const [name, setName] = useState("")
  const [rate, setRate] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => listVendorTaxRates({ limit: 100 }),
  })

  // The country tax regions are set up by the platform; a seller adds a rate inside one.
  const { data: regions } = useQuery({
    queryKey: ["vendor-tax-regions", "for-tax-rates"],
    queryFn: () => listVendorTaxRegions(),
    enabled: open,
  })

  const openCreate = () => {
    setEditing(null)
    setRegionId("")
    setName("")
    setRate("")
    setOpen(true)
  }

  const openEdit = (taxRate: VendorTaxRate) => {
    setEditing(taxRate)
    setName(taxRate.name)
    setRate(String(taxRate.rate ?? ""))
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? updateVendorTaxRateById(editing.id, { name: name.trim(), rate: Number(rate) })
        : createVendorTaxRate({ tax_region_id: regionId, name: name.trim(), rate: Number(rate) }),
    onSuccess: () => {
      toast.success(editing ? "Tax rate updated" : "Tax rate created")
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      setOpen(false)
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save tax rate"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorTaxRate(id),
    onSuccess: () => {
      toast.success("Tax rate deleted")
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete tax rate"),
  })

  const handleDelete = async (taxRate: VendorTaxRate) => {
    const confirmed = await prompt({
      title: "Delete tax rate",
      description: `Delete "${taxRate.name}"? Your products will use the platform tax rate again.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (confirmed) {
      deleteMutation.mutate(taxRate.id)
    }
  }

  const handleSave = () => {
    const percent = Number(rate)
    if (!name.trim() || (!editing && !regionId) || rate === "" || Number.isNaN(percent) || percent < 0 || percent > 100) {
      toast.error("Enter a name, a country and a rate between 0 and 100")
      return
    }
    saveMutation.mutate()
  }

  const taxRates = data?.tax_rates ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">My Tax Rates</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            A rate you add applies to your own products and shipping in that country. Everything else uses the
            platform rate.
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={openCreate}>
          <PlusMini /> Create
        </Button>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Country</Table.HeaderCell>
            <Table.HeaderCell>Rate</Table.HeaderCell>
            <Table.HeaderCell className="w-24" />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {taxRates.map((taxRate) => (
            <Table.Row key={taxRate.id}>
              <Table.Cell>{taxRate.name}</Table.Cell>
              <Table.Cell>{taxRate.tax_region?.country_code?.toUpperCase() ?? "-"}</Table.Cell>
              <Table.Cell>{taxRate.rate ?? "-"}%</Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-x-1">
                  <Button size="small" variant="transparent" onClick={() => openEdit(taxRate)} aria-label={`Edit ${taxRate.name}`}>
                    <PencilSquare />
                  </Button>
                  <Button size="small" variant="transparent" onClick={() => handleDelete(taxRate)} aria-label={`Delete ${taxRate.name}`}>
                    <Trash />
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {!isLoading && taxRates.length === 0 && (
        <div className="px-6 py-10 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            You have no tax rates of your own, so the platform rate applies to your products.
          </Text>
        </div>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title>{editing ? "Edit tax rate" : "Create tax rate"}</Drawer.Title>
            <Drawer.Description className="text-ui-fg-subtle text-sm">
              Applies to your products and shipping options in that country.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 p-6">
            {!editing && (
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">Country</Label>
                <Select value={regionId} onValueChange={setRegionId}>
                  <Select.Trigger>
                    <Select.Value placeholder="Choose a country" />
                  </Select.Trigger>
                  <Select.Content>
                    {(regions?.tax_regions ?? []).map((region) => (
                      <Select.Item key={region.id} value={region.id}>
                        {region.country_code.toUpperCase()}
                        {region.province_code ? ` - ${region.province_code.toUpperCase()}` : ""}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Sales tax" />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Rate (%)</Label>
              <Input type="number" min="0" max="100" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} />
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={saveMutation.isPending}>{editing ? "Save" : "Create"}</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
