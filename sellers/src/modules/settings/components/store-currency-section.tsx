"use client"

import {
  deleteVendorCurrency,
  listVendorCurrencies,
  type VendorCurrency,
} from "@lib/data/vendor-client"
import {
  ArrowUpDown,
  CheckCircle,
  CurrencyDollar,
  EllipsisHorizontal,
  InformationCircleSolid,
  MagnifyingGlass,
  PencilSquare,
  Plus,
  Trash,
  XCircle,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Prompt,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { AddCurrencyModal } from "./currencies/add-currency-modal"
import { EditCurrencyModal } from "./currencies/edit-currency-modal"

type SortField = "name" | "code"
type SortOrder = "asc" | "desc"

export const StoreCurrencySection = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingCurrency, setEditingCurrency] = useState<VendorCurrency | null>(null)
  const [deletingCurrency, setDeletingCurrency] = useState<VendorCurrency | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-currencies"],
    queryFn: () => listVendorCurrencies(),
  })

  const currencies = useMemo(() => data?.currencies ?? [], [data?.currencies])
  const defaultCurrency = useMemo(
    () => currencies.find((c) => c.is_default) || currencies[0],
    [currencies]
  )

  // Filter by search query
  const filteredCurrencies = useMemo(() => {
    let result = [...currencies]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.symbol.toLowerCase().includes(q)
      )
    }

    // Sort by field and direction
    result.sort((a, b) => {
      const valA = sortField === "name" ? a.name.toLowerCase() : a.code.toLowerCase()
      const valB = sortField === "name" ? b.name.toLowerCase() : b.code.toLowerCase()

      if (valA < valB) return sortOrder === "asc" ? -1 : 1
      if (valA > valB) return sortOrder === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [currencies, search, sortField, sortOrder])

  const { mutateAsync: removeCurrencyMutation, isPending: isRemoving } = useMutation({
    mutationFn: async (code: string) => {
      await deleteVendorCurrency(code)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-currencies"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-taxonomy"] })
      toast.success("Currency removed successfully")
      setDeletingCurrency(null)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove currency")
    },
  })

  return (
    <Container className="divide-y p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Currencies</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Manage the currencies that your store supports for products and checkout.
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          {defaultCurrency && (
            <div className="flex items-center gap-x-2 mr-2">
              <Text size="small" className="text-ui-fg-subtle">
                Default:
              </Text>
              <Badge size="small" color="green">
                {defaultCurrency.code.toUpperCase()}
              </Badge>
            </div>
          )}

          {/* Three-dot Action Menu for Add */}
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton variant="transparent" size="small">
                <EllipsisHorizontal className="text-ui-fg-subtle" />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item
                className="cursor-pointer flex items-center gap-x-2"
                onClick={() => setAddModalOpen(true)}
              >
                <Plus className="text-ui-fg-subtle" />
                Add
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>

          <Button
            size="small"
            variant="secondary"
            className="flex items-center gap-x-1.5"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Currency
          </Button>
        </div>
      </div>

      {/* Toolbar: Search and Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 bg-ui-bg-subtle/50">
        <div className="relative w-72">
          <MagnifyingGlass className="text-ui-fg-muted absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
          <Input
            type="search"
            placeholder="Search currencies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-small bg-ui-bg-base"
          />
        </div>

        <div className="flex items-center gap-x-2">
          {/* Sorting dropdown */}
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button size="small" variant="secondary" className="flex items-center gap-x-1.5">
                <ArrowUpDown className="h-4 w-4 text-ui-fg-subtle" />
                <span>
                  Sort by: <span className="font-semibold capitalize">{sortField}</span> ({sortOrder.toUpperCase()})
                </span>
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Label>Sort Field</DropdownMenu.Label>
              <DropdownMenu.RadioGroup
                value={sortField}
                onValueChange={(val) => setSortField(val as SortField)}
              >
                <DropdownMenu.RadioItem value="name">Name</DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem value="code">Code</DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>

              <DropdownMenu.Separator />

              <DropdownMenu.Label>Order</DropdownMenu.Label>
              <DropdownMenu.RadioGroup
                value={sortOrder}
                onValueChange={(val) => setSortOrder(val as SortOrder)}
              >
                <DropdownMenu.RadioItem value="asc">Ascending</DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem value="desc">Descending</DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell className="w-1/3">Currency</Table.HeaderCell>
              <Table.HeaderCell className="w-1/6">Code</Table.HeaderCell>
              <Table.HeaderCell className="w-1/6">Symbol</Table.HeaderCell>
              <Table.HeaderCell className="w-1/6">Tax-Inclusive Pricing</Table.HeaderCell>
              <Table.HeaderCell className="w-1/6 text-right">Status</Table.HeaderCell>
              <Table.HeaderCell className="w-[50px] text-right"></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <td colSpan={6} className="h-24 text-center text-ui-fg-subtle">
                  <Text size="small">Loading currencies...</Text>
                </td>
              </Table.Row>
            ) : filteredCurrencies.length === 0 ? (
              <Table.Row>
                <td colSpan={6} className="h-24 text-center text-ui-fg-subtle">
                  <div className="flex items-center justify-center gap-x-2">
                    <InformationCircleSolid className="h-4 w-4" />
                    <Text size="small">
                      {search ? "No currencies match your search." : "No currencies configured."}
                    </Text>
                  </div>
                </td>
              </Table.Row>
            ) : (
              filteredCurrencies.map((curr) => {
                return (
                  <Table.Row key={curr.code}>
                    <Table.Cell>
                      <div className="flex items-center gap-x-2">
                        <CurrencyDollar className="h-4 w-4 text-ui-fg-muted" />
                        <Text size="small" weight="plus" className="text-ui-fg-base">
                          {curr.name}
                        </Text>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall">{curr.code.toUpperCase()}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle">
                        {curr.symbol}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      {curr.is_tax_inclusive ? (
                        <Badge size="small" color="green">
                          True
                        </Badge>
                      ) : (
                        <Badge size="small" color="grey">
                          False
                        </Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {curr.is_default ? (
                        <Badge size="small" color="green">
                          Default
                        </Badge>
                      ) : (
                        <Badge size="small" color="grey">
                          Supported
                        </Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {/* Row Action Menu */}
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton variant="transparent" size="small">
                            <EllipsisHorizontal className="text-ui-fg-subtle" />
                          </IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end">
                          <DropdownMenu.Item
                            className="cursor-pointer flex items-center gap-x-2"
                            onClick={() => setEditingCurrency(curr)}
                          >
                            <PencilSquare className="text-ui-fg-subtle" />
                            Edit
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            className="cursor-pointer flex items-center gap-x-2 text-ui-fg-error"
                            disabled={curr.is_default}
                            onClick={() => {
                              if (!curr.is_default) {
                                setDeletingCurrency(curr)
                              }
                            }}
                          >
                            <Trash className="text-ui-fg-error" />
                            Remove
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

      {/* Add Currency Modal */}
      <AddCurrencyModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        existingCurrencies={currencies}
      />

      {/* Edit Currency Modal */}
      <EditCurrencyModal
        currency={editingCurrency}
        open={Boolean(editingCurrency)}
        onOpenChange={(open) => !open && setEditingCurrency(null)}
      />

      {/* Remove Confirmation Prompt */}
      <Prompt
        open={Boolean(deletingCurrency)}
        onOpenChange={(open) => !open && setDeletingCurrency(null)}
      >
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Remove Currency</Prompt.Title>
            <Prompt.Description>
              Are you sure you want to remove {deletingCurrency?.name} ({deletingCurrency?.code.toUpperCase()}) from supported currencies?
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel onClick={() => setDeletingCurrency(null)}>
              Cancel
            </Prompt.Cancel>
            <Button
              size="small"
              variant="danger"
              isLoading={isRemoving}
              onClick={() => deletingCurrency && removeCurrencyMutation(deletingCurrency.code)}
            >
              Remove
            </Button>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}
