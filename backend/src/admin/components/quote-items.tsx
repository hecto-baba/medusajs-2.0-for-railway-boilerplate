import type {
  AdminOrder,
  AdminOrderLineItem,
  AdminOrderPreview,
} from "@medusajs/framework/types"
import { Badge, Text } from "@medusajs/ui"
import { useMemo } from "react"
import { Amount } from "./amount"
import { DocumentText } from "@medusajs/icons"

export const QuoteItem = ({
  item,
  originalItem,
  currencyCode,
}: {
  item: AdminOrderPreview["items"][0]
  originalItem?: AdminOrderLineItem
  currencyCode: string
}) => {
  const isItemUpdated = useMemo(
    () => !!item.actions?.find((a: any) => a.action === "ITEM_UPDATE"),
    [item]
  )

  return (
    <div
      key={item.id}
      className="text-ui-fg-subtle grid grid-cols-2 items-center gap-x-4 px-6 py-4 text-left border-b last:border-b-0"
    >
      <div className="flex items-center gap-x-4">
        <div className="w-10 h-10 rounded-md bg-ui-bg-subtle border flex items-center justify-center overflow-hidden flex-shrink-0">
          {item.thumbnail ? (
            <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <DocumentText className="w-5 h-5 text-ui-fg-muted" />
          )}
        </div>
        <div>
          <Text
            size="small"
            leading="compact"
            weight="plus"
            className="text-ui-fg-base"
          >
            {item.title}
          </Text>
          {item.variant_sku && (
            <div className="flex items-center gap-x-1">
              <Text size="xsmall" className="font-mono text-ui-fg-muted uppercase">
                {item.variant_sku}
              </Text>
            </div>
          )}
          {item.variant?.options && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {item.variant.options.map((o: any) => o.value).join(" · ")}
            </Text>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 items-center gap-x-4">
        <div className="flex items-center justify-end">
          <Amount
            className="text-sm text-right justify-end items-end"
            currencyCode={currencyCode}
            amount={Number(item.detail?.unit_price ?? item.unit_price ?? 0)}
            originalAmount={Number(originalItem?.unit_price ?? item.unit_price ?? 0)}
          />
        </div>

        <div className="flex items-center justify-center gap-x-2">
          <div className="w-fit min-w-[27px]">
            <Badge size="xsmall" color="grey">
              <span className="tabular-nums text-xs">{item.quantity}</span>x
            </Badge>
          </div>
          {isItemUpdated && (
            <Badge
              size="2xsmall"
              rounded="full"
              color="orange"
              className="mr-1"
            >
              Modified
            </Badge>
          )}
        </div>

        <Amount
          className="text-sm font-semibold text-right justify-end items-end"
          currencyCode={currencyCode}
          amount={item.total}
          originalAmount={originalItem?.total}
        />
      </div>
    </div>
  )
}

export const QuoteItems = ({
  order,
  preview,
}: {
  order: AdminOrder
  preview: AdminOrderPreview
}) => {
  const itemsMap = useMemo(() => {
    return new Map((order?.items || []).map((item) => [item.id, item]))
  }, [order])

  const previewItems = preview?.items || order?.items || []

  return (
    <div className="divide-y divide-ui-border-base">
      {previewItems.map((item: any) => {
        return (
          <QuoteItem
            key={item.id}
            item={item}
            originalItem={itemsMap.get(item.id)}
            currencyCode={order?.currency_code || "EUR"}
          />
        )
      })}
    </div>
  )
}
