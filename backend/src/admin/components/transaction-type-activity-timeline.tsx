import { Badge, Select, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../lib/sdk"
import {
  ACTIVITY_LABELS,
  ActivityListResponse,
  formatRelative,
  STATUS_STYLES,
  TransactionTypeActivity,
  TransactionTypeActivityAction,
  TransactionTypeStatus,
} from "../types/transaction-type"

type ActivityTimelineProps = {
  transactionTypeId: string
}

const StatusChip = ({ status }: { status?: string | null }) => {
  if (!status) {
    return <span className="text-ui-fg-muted">&mdash;</span>
  }

  const style = STATUS_STYLES[status as TransactionTypeStatus]

  return (
    <Badge size="2xsmall" className={style?.badge}>
      {style?.label ?? status}
    </Badge>
  )
}

const ActivityDetail = ({ activity }: { activity: TransactionTypeActivity }) => {
  if (activity.action === TransactionTypeActivityAction.STATUS_CHANGED) {
    return (
      <div className="flex items-center gap-2">
        <StatusChip status={activity.previous_status} />
        <span className="text-ui-fg-muted">&rarr;</span>
        <StatusChip status={activity.new_status} />
      </div>
    )
  }

  if (activity.action === TransactionTypeActivityAction.CREATED) {
    return (
      <div className="flex items-center gap-2">
        <Text size="small" className="text-ui-fg-subtle">
          as
        </Text>
        <StatusChip status={activity.new_status} />
      </div>
    )
  }

  if (activity.changes && Object.keys(activity.changes).length) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        {Object.keys(activity.changes).join(", ")}
      </Text>
    )
  }

  return null
}

/**
 * The audit trail for one transaction type.
 *
 * Both the CRUD activity and status activity views are this same list - the
 * filter switches between them, rather than the two being separate screens
 * showing near-identical rows.
 */
export const TransactionTypeActivityTimeline = ({
  transactionTypeId,
}: ActivityTimelineProps) => {
  const [filter, setFilter] = useState<"all" | "status_changed">("all")

  const { data, isLoading, isError, error } = useQuery<ActivityListResponse>({
    queryFn: () =>
      sdk.client.fetch(
        `/admin/transaction-types/${transactionTypeId}/activities`,
        {
          query:
            filter === "all"
              ? { limit: 50 }
              : { limit: 50, action: "status_changed" },
        }
      ),
    queryKey: [["transaction-type-activities", transactionTypeId, filter]],
  })

  const activities = data?.activities ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Text size="small" weight="plus">
          Activity
        </Text>

        <Select
          value={filter}
          onValueChange={(value) => setFilter(value as typeof filter)}
        >
          <Select.Trigger className="w-[160px]">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All activity</Select.Item>
            <Select.Item value="status_changed">Status changes</Select.Item>
          </Select.Content>
        </Select>
      </div>

      {isLoading ? (
        <Text size="small" className="text-ui-fg-subtle">
          Loading activity...
        </Text>
      ) : isError ? (
        // Distinguished from "no activity": telling an admin the history is
        // empty when the request actually failed is worse than saying nothing.
        <Text size="small" className="text-ui-fg-error">
          {(error as any)?.message || "Could not load activity."}
        </Text>
      ) : !activities.length ? (
        <Text size="small" className="text-ui-fg-subtle">
          {filter === "all"
            ? "No activity recorded yet."
            : "No status changes recorded yet."}
        </Text>
      ) : (
        <div className="flex flex-col">
          {activities.map((activity, index) => (
            <div key={activity.id} className="flex gap-3">
              {/* Dot plus the line joining it to the next entry. */}
              <div className="flex flex-col items-center">
                <div className="mt-1.5 size-2 rounded-full bg-ui-fg-muted" />
                {index < activities.length - 1 && (
                  <div className="w-px flex-1 bg-ui-border-base" />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1 pb-5">
                <div className="flex items-center justify-between gap-2">
                  <Text size="small" weight="plus">
                    {ACTIVITY_LABELS[activity.action] ?? activity.action}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {formatRelative(activity.created_at)}
                  </Text>
                </div>

                <ActivityDetail activity={activity} />

                <Text size="xsmall" className="text-ui-fg-muted">
                  {activity.actor_email ?? activity.actor_id ?? "system"}
                </Text>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TransactionTypeActivityTimeline
