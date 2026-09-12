"use client"

import { StatusBadge, Text } from "@medusajs/ui"

/**
 * Cells copied from the admin dashboard's table-cells, minus the parts that
 * cannot cross: react-i18next is replaced with plain strings, and
 * DataTableStatusIndicator with StatusBadge, which is its exported equivalent.
 */

export const Thumbnail = ({ src }: { src?: string | null }) => {
  if (!src) {
    return (
      <div className="bg-ui-bg-component border-ui-border-base h-8 w-6 shrink-0 rounded border" />
    )
  }

  return (
    // A plain img rather than next/image: thumbnails are served by whichever
    // file provider the backend is configured with, and next/image needs every
    // such host declared up front in next.config.js.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="bg-ui-bg-component border-ui-border-base h-8 w-6 shrink-0 rounded border object-cover"
    />
  )
}

export const ProductCell = ({
  thumbnail,
  title,
}: {
  thumbnail?: string | null
  title: string
}) => (
  <div className="flex h-full w-full max-w-[250px] items-center gap-x-3 overflow-hidden">
    <Thumbnail src={thumbnail} />
    <span className="truncate">{title}</span>
  </div>
)

export const PlaceholderCell = () => (
  <span className="text-ui-fg-muted">—</span>
)

// The admin's four product statuses, with its colours and labels.
const PRODUCT_STATUS: Record<string, ["grey" | "orange" | "green" | "red", string]> = {
  draft: ["grey", "Draft"],
  proposed: ["orange", "Proposed"],
  published: ["green", "Published"],
  rejected: ["red", "Rejected"],
}

export const ProductStatusCell = ({ status }: { status?: string }) => {
  const variant = status ? PRODUCT_STATUS[status] : undefined

  if (!variant) {
    return <PlaceholderCell />
  }

  const [color, label] = variant

  return <StatusBadge color={color}>{label}</StatusBadge>
}

/**
 * Lists the first entry and summarises the rest, the way the admin's
 * sales-channel cell does, so a product in many channels does not stretch the
 * column.
 */
export const ListSummaryCell = ({
  items,
  inlineLabel,
}: {
  items: string[]
  inlineLabel: string
}) => {
  if (!items.length) {
    return <PlaceholderCell />
  }

  const [first, ...rest] = items

  return (
    <div className="flex items-center gap-x-1 overflow-hidden">
      <span className="truncate">{first}</span>
      {rest.length > 0 && (
        <Text size="small" leading="compact" className="text-ui-fg-subtle shrink-0">
          + {rest.length} more {inlineLabel}
        </Text>
      )}
    </div>
  )
}
