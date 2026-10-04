import { ExclamationCircle, MagnifyingGlass } from "@medusajs/icons"
import { Button, Text, clx } from "@medusajs/ui"
import React from "react"
import Link from "next/link"

export type NoResultsProps = {
  title?: string
  message?: string
  className?: string
}

export const NoResults = ({ title, message, className }: NoResultsProps) => {
  return (
    <div
      className={clx(
        "flex h-[350px] w-full items-center justify-center",
        className
      )}
    >
      <div className="flex flex-col items-center gap-y-2">
        <MagnifyingGlass className="text-ui-fg-subtle size-5" />
        <Text size="small" leading="compact" weight="plus">
          {title ?? "No results"}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {message ?? "No records match the current filters or search query."}
        </Text>
      </div>
    </div>
  )
}

type ActionProps = {
  action?: {
    to: string
    label: string
  }
}

export type NoRecordsProps = {
  title?: string
  message?: string
  className?: string
  icon?: React.ReactNode
} & ActionProps

const DefaultButton = ({ action }: ActionProps) =>
  action ? (
    <Link href={action.to}>
      <Button variant="secondary" size="small">
        {action.label}
      </Button>
    </Link>
  ) : null

export const NoRecords = ({
  title,
  message,
  action,
  className,
  icon = <ExclamationCircle className="text-ui-fg-subtle size-5" />,
}: NoRecordsProps) => {
  return (
    <div
      className={clx(
        "flex min-h-[180px] w-full flex-col items-center justify-center gap-y-4 py-12",
        className
      )}
    >
      <div className="flex flex-col items-center gap-y-3">
        {icon}

        <div className="flex flex-col items-center gap-y-1">
          <Text size="small" leading="compact" weight="plus">
            {title ?? "No records"}
          </Text>

          {message && (
            <Text size="small" className="text-ui-fg-muted">
              {message}
            </Text>
          )}
        </div>
      </div>

      <DefaultButton action={action} />
    </div>
  )
}
