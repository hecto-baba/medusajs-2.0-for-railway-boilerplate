"use client"

import { ALL_CURRENCIES } from "@lib/data/currencies"
import { addVendorCurrency, type VendorCurrency } from "@lib/data/vendor-client"
import { MagnifyingGlass } from "@medusajs/icons"
import {
  Badge,
  Button,
  Checkbox,
  FocusModal,
  Heading,
  Input,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type AddCurrencyModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingCurrencies: VendorCurrency[]
}

export const AddCurrencyModal = ({
  open,
  onOpenChange,
  existingCurrencies,
}: AddCurrencyModalProps) => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [taxInclusiveMap, setTaxInclusiveMap] = useState<Record<string, boolean>>({})

  const existingCodesSet = useMemo(
    () => new Set(existingCurrencies.map((c) => c.code.toUpperCase())),
    [existingCurrencies]
  )

  const availableCurrencies = useMemo(() => {
    return Object.values(ALL_CURRENCIES).filter(
      (c) => !existingCodesSet.has(c.code.toUpperCase())
    )
  }, [existingCodesSet])

  const filteredCurrencies = useMemo(() => {
    if (!search.trim()) return availableCurrencies
    const q = search.toLowerCase()
    return availableCurrencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    )
  }, [availableCurrencies, search])

  const toggleSelect = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const toggleTaxInclusive = (code: string, checked: boolean) => {
    setTaxInclusiveMap((prev) => ({ ...prev, [code]: checked }))
  }

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      for (const code of selectedCodes) {
        await addVendorCurrency({
          code,
          is_default: false,
          is_tax_inclusive: Boolean(taxInclusiveMap[code]),
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-currencies"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-taxonomy"] })
      toast.success(
        selectedCodes.length === 1
          ? "Currency added successfully"
          : `${selectedCodes.length} currencies added successfully`
      )
      onOpenChange(false)
      setSelectedCodes([])
      setSearch("")
      setTaxInclusiveMap({})
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add currencies")
    },
  })

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex items-center gap-x-2">
            <Heading level="h2">Add Currencies</Heading>
          </div>
          <div className="flex items-center gap-x-2">
            <Button
              size="small"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="primary"
              disabled={selectedCodes.length === 0}
              isLoading={isPending}
              onClick={() => mutateAsync()}
            >
              Add {selectedCodes.length > 0 ? `(${selectedCodes.length})` : ""}
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col overflow-hidden p-6 gap-y-4 max-w-4xl mx-auto w-full">
          <div className="flex flex-col gap-y-1">
            <Text className="text-ui-fg-subtle" size="small">
              Select one or more currencies that your store supports for products and checkout.
            </Text>
          </div>

          <div className="relative">
            <MagnifyingGlass className="text-ui-fg-muted absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
            <Input
              type="search"
              placeholder="Search by currency name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border border-ui-border-base rounded-lg flex-1 overflow-y-auto divide-y divide-ui-border-base min-h-[350px]">
            {filteredCurrencies.length === 0 ? (
              <div className="p-8 text-center text-ui-fg-subtle">
                <Text size="small">No matching currencies found.</Text>
              </div>
            ) : (
              filteredCurrencies.map((curr) => {
                const isSelected = selectedCodes.includes(curr.code)
                return (
                  <div
                    key={curr.code}
                    onClick={() => toggleSelect(curr.code)}
                    className="flex items-center justify-between p-3.5 hover:bg-ui-bg-subtle-hover cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-x-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(curr.code)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Badge size="2xsmall">{curr.code}</Badge>
                      <Text size="small" weight="plus" className="text-ui-fg-base">
                        {curr.name}
                      </Text>
                      <Text size="small" className="text-ui-fg-subtle">
                        ({curr.symbol})
                      </Text>
                    </div>

                    <div
                      className="flex items-center gap-x-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Tax inclusive
                      </Text>
                      <Switch
                        size="small"
                        checked={Boolean(taxInclusiveMap[curr.code])}
                        onCheckedChange={(checked) =>
                          toggleTaxInclusive(curr.code, checked)
                        }
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
