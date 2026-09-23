export enum TransactionTypeStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
}

export const TRANSACTION_TYPE_STATUSES = [
  TransactionTypeStatus.DRAFT,
  TransactionTypeStatus.ACTIVE,
  TransactionTypeStatus.INACTIVE,
  TransactionTypeStatus.ARCHIVED,
] as const

/**
 * Status colours, so a lifecycle state reads the same in the table, the
 * detail drawer and the activity timeline.
 *
 * `color` maps onto StatusBadge's own variants; `badge` is for the places a
 * plain Badge is used instead.
 */
export const STATUS_STYLES: Record<
  TransactionTypeStatus,
  { label: string; color: "green" | "grey" | "orange" | "red"; badge: string }
> = {
  [TransactionTypeStatus.DRAFT]: {
    label: "Draft",
    color: "grey",
    badge: "bg-ui-tag-neutral-bg text-ui-tag-neutral-text",
  },
  [TransactionTypeStatus.ACTIVE]: {
    label: "Active",
    color: "green",
    badge: "bg-ui-tag-green-bg text-ui-tag-green-text",
  },
  [TransactionTypeStatus.INACTIVE]: {
    label: "Inactive",
    color: "orange",
    badge: "bg-ui-tag-orange-bg text-ui-tag-orange-text",
  },
  [TransactionTypeStatus.ARCHIVED]: {
    label: "Archived",
    color: "red",
    badge: "bg-ui-tag-red-bg text-ui-tag-red-text",
  },
}

/**
 * The lifecycle moves the UI offers from each state. Mirrors the server's
 * transition guard: the buttons shown are exactly the moves that will be
 * accepted, so an admin is never offered an action that returns an error.
 */
export const ALLOWED_TRANSITIONS: Record<
  TransactionTypeStatus,
  TransactionTypeStatus[]
> = {
  [TransactionTypeStatus.DRAFT]: [TransactionTypeStatus.ACTIVE],
  [TransactionTypeStatus.ACTIVE]: [TransactionTypeStatus.INACTIVE],
  [TransactionTypeStatus.INACTIVE]: [
    TransactionTypeStatus.ACTIVE,
    TransactionTypeStatus.ARCHIVED,
  ],
  [TransactionTypeStatus.ARCHIVED]: [],
}

/** Verb an admin would use for a transition, rather than the state's name. */
export const TRANSITION_LABELS: Record<TransactionTypeStatus, string> = {
  [TransactionTypeStatus.DRAFT]: "Move to draft",
  [TransactionTypeStatus.ACTIVE]: "Activate",
  [TransactionTypeStatus.INACTIVE]: "Deactivate",
  [TransactionTypeStatus.ARCHIVED]: "Archive",
}

export enum TransactionTypeActivityAction {
  CREATED = "created",
  UPDATED = "updated",
  DELETED = "deleted",
  RESTORED = "restored",
  STATUS_CHANGED = "status_changed",
  REORDERED = "reordered",
  IMPORTED = "imported",
}

export const ACTIVITY_LABELS: Record<TransactionTypeActivityAction, string> = {
  [TransactionTypeActivityAction.CREATED]: "Created",
  [TransactionTypeActivityAction.UPDATED]: "Updated",
  [TransactionTypeActivityAction.DELETED]: "Deleted",
  [TransactionTypeActivityAction.RESTORED]: "Restored",
  [TransactionTypeActivityAction.STATUS_CHANGED]: "Status changed",
  [TransactionTypeActivityAction.REORDERED]: "Reordered",
  [TransactionTypeActivityAction.IMPORTED]: "Imported",
}

export type TransactionType = {
  id: string
  name: string
  code: string
  description?: string | null
  icon_url?: string | null
  status: TransactionTypeStatus
  rank: number
  created_at: string
  updated_at: string
  /** Only present when the list was fetched with `with_deleted`. */
  deleted_at?: string | null
}

export type TransactionTypeActivity = {
  id: string
  action: TransactionTypeActivityAction
  actor_id?: string | null
  actor_email?: string | null
  previous_status?: string | null
  new_status?: string | null
  changes?: Record<string, { from: unknown; to: unknown }> | null
  created_at: string
}

export type TransactionTypeListResponse = {
  transaction_types: TransactionType[]
  count: number
  limit: number
  offset: number
}

export type TransactionTypeResponse = {
  transaction_type: TransactionType
}

export type ActivityListResponse = {
  activities: TransactionTypeActivity[]
  count: number
  limit: number
  offset: number
}

export type ImportRowError = {
  row: number
  message: string
}

export type ImportSummaryResponse = {
  transaction_id: string
  summary: {
    filename: string
    to_create: number
    to_update: number
    errors: ImportRowError[]
  }
}

export type ExportResponse = {
  export: {
    id: string
    filename: string
    url: string
    count: number
  }
}

/** The columns the CSV import template expects, in order. */
export const IMPORT_TEMPLATE_COLUMNS = [
  "name",
  "code",
  "description",
  "icon_url",
  "status",
] as const

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

/** Short relative time, falling back to an absolute date past a week. */
export const formatRelative = (value: string) => {
  const then = new Date(value).getTime()
  const seconds = Math.floor((Date.now() - then) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return formatDateTime(value)
}
