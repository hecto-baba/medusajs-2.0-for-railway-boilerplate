"use client"

import { updateVendorCurrency, type VendorCurrency } from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Heading,
  Prompt,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type EditCurrencyModalProps = {
  currency: VendorCurrency | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const EditCurrencyModal = ({
  currency,
  open,
  onOpenChange,
}: EditCurrencyModalProps) => {
  const queryClient = useQueryClient()
  const [isDefault, setIsDefault] = useState(false)
  const [isTaxInclusive, setIsTaxInclusive] = useState(false)

  useEffect(() => {
    if (currency) {
      setIsDefault(Boolean(currency.is_default))
      setIsTaxInclusive(Boolean(currency.is_tax_inclusive))
    }
  }, [currency])

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      if (!currency) return
      await updateVendorCurrency(currency.code, {
        is_default: isDefault,
        is_tax_inclusive: isTaxInclusive,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-currencies"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-taxonomy"] })
      toast.success("Currency updated successfully")
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update currency")
    },
  })

  if (!currency) return null

  return (
    <Prompt open={open} onOpenChange={onOpenChange}>
      <Prompt.Content className="max-w-md">
        <Prompt.Header>
          <Prompt.Title>Edit Currency</Prompt.Title>
          <Prompt.Description>
            Configure settings for {currency.name} ({currency.code.toUpperCase()}).
          </Prompt.Description>
        </Prompt.Header>

        <div className="flex flex-col gap-y-4 py-4">
          <div className="flex items-center justify-between p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
            <div className="flex flex-col">
              <Text size="small" weight="plus" className="text-ui-fg-base">
                Default Currency
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Set as the primary store currency for customer orders.
              </Text>
            </div>
            <Switch
              size="small"
              checked={isDefault}
              disabled={currency.is_default} // Cannot uncheck default directly
              onCheckedChange={setIsDefault}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
            <div className="flex flex-col">
              <Text size="small" weight="plus" className="text-ui-fg-base">
                Tax-Inclusive Pricing
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Product prices in this currency already include applicable taxes.
              </Text>
            </div>
            <Switch
              size="small"
              checked={isTaxInclusive}
              onCheckedChange={setIsTaxInclusive}
            />
          </div>
        </div>

        <Prompt.Footer>
          <Prompt.Cancel onClick={() => onOpenChange(false)}>Cancel</Prompt.Cancel>
          <Button
            size="small"
            variant="primary"
            isLoading={isPending}
            onClick={() => mutateAsync()}
          >
            Save changes
          </Button>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  )
}
