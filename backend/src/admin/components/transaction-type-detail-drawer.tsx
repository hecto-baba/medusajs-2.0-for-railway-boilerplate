import {
  Button,
  Drawer,
  Heading,
  StatusBadge,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../lib/sdk"
import {
  ALLOWED_TRANSITIONS,
  formatDateTime,
  STATUS_STYLES,
  TransactionType,
  TransactionTypeStatus,
  TRANSITION_LABELS,
} from "../types/transaction-type"
import { TransactionTypeActivityTimeline } from "./transaction-type-activity-timeline"
import { TransactionTypeFormModal } from "./transaction-type-form-modal"

type DetailDrawerProps = {
  transactionType: TransactionType | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
    <div className="text-right">{children}</div>
  </div>
)

/**
 * Detail view as a drawer rather than its own route: inspecting a type is a
 * glance, and a full page would lose the admin's place in the list every time.
 */
export const TransactionTypeDetailDrawer = ({
  transactionType,
  open,
  onOpenChange,
  onChanged,
}: DetailDrawerProps) => {
  const prompt = usePrompt()
  const [editOpen, setEditOpen] = useState(false)

  const changeStatus = useMutation({
    mutationFn: (status: TransactionTypeStatus) =>
      sdk.client.fetch(
        `/admin/transaction-types/${transactionType!.id}/status`,
        { method: "POST", body: { status } }
      ),
    onSuccess: (_data, status) => {
      toast.success(`Moved to ${STATUS_STYLES[status].label.toLowerCase()}`)
      onChanged()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not change the status")
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/transaction-types/${transactionType!.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success(`"${transactionType?.name}" deleted`)
      onOpenChange(false)
      onChanged()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not delete the transaction type")
    },
  })

  const restore = useMutation({
    mutationFn: () =>
      sdk.client.fetch(
        `/admin/transaction-types/${transactionType!.id}/restore`,
        { method: "POST" }
      ),
    onSuccess: () => {
      toast.success(`"${transactionType?.name}" restored`)
      onChanged()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not restore the transaction type")
    },
  })

  if (!transactionType) {
    return null
  }

  // Fall back rather than index blindly: an unrecognised status would
  // otherwise throw on style.color and blank the whole drawer.
  const style = STATUS_STYLES[transactionType.status] ?? {
    label: transactionType.status,
    color: "grey" as const,
    badge: "",
  }
  const transitions = ALLOWED_TRANSITIONS[transactionType.status] ?? []
  const isDeleted = !!transactionType.deleted_at

  const confirmAndRun = async (
    title: string,
    description: string,
    run: () => void
  ) => {
    const confirmed = await prompt({
      title,
      description,
      confirmText: "Confirm",
      cancelText: "Cancel",
    })

    if (confirmed) run()
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <Drawer.Content>
          <Drawer.Header>
            <div className="flex w-full items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {transactionType.icon_url && (
                  <img
                    src={transactionType.icon_url}
                    alt=""
                    className="size-8 rounded-md border border-ui-border-base object-cover"
                  />
                )}
                <div>
                  <Heading level="h2">{transactionType.name}</Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    {transactionType.code}
                  </Text>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isDeleted && <StatusBadge color="red">Deleted</StatusBadge>}
                <StatusBadge color={style.color}>{style.label}</StatusBadge>
              </div>
            </div>
          </Drawer.Header>

          <Drawer.Body className="flex flex-col gap-6 overflow-y-auto">
            <div className="flex flex-col">
              <Row label="Description">
                <Text size="small">
                  {transactionType.description || (
                    <span className="text-ui-fg-muted">&mdash;</span>
                  )}
                </Text>
              </Row>
              <Row label="Code">
                <Text size="small">{transactionType.code}</Text>
              </Row>
              <Row label="Status">
                <StatusBadge color={style.color}>{style.label}</StatusBadge>
              </Row>
              <Row label="Order">
                <Text size="small">{transactionType.rank + 1}</Text>
              </Row>
              <Row label="Created">
                <Text size="small">
                  {formatDateTime(transactionType.created_at)}
                </Text>
              </Row>
              <Row label="Updated">
                <Text size="small">
                  {formatDateTime(transactionType.updated_at)}
                </Text>
              </Row>
            </div>

            <div className="h-px bg-ui-border-base" />

            <TransactionTypeActivityTimeline
              transactionTypeId={transactionType.id}
            />
          </Drawer.Body>

          <Drawer.Footer>
            <div className="flex w-full items-center justify-between gap-2">
              {isDeleted ? (
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={restore.isPending}
                  onClick={() => restore.mutate()}
                >
                  Restore
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="danger"
                  isLoading={remove.isPending}
                  onClick={() =>
                    confirmAndRun(
                      "Delete transaction type",
                      `"${transactionType.name}" will be removed from the list. Its history is kept, the code becomes available again, and it can be restored later.`,
                      () => remove.mutate()
                    )
                  }
                >
                  Delete
                </Button>
              )}

              {/* A deleted type offers no lifecycle moves or edits - it has
                  to be restored first. */}
              <div className="flex items-center gap-2">
                {/*
                  Only the transitions the server will accept are offered, so
                  an admin is never shown a button that returns an error.
                */}
                {!isDeleted && transitions.map((status) => {
                  const isArchive = status === TransactionTypeStatus.ARCHIVED

                  return (
                    <Button
                      key={status}
                      size="small"
                      variant="secondary"
                      isLoading={changeStatus.isPending}
                      onClick={() => {
                        if (isArchive) {
                          confirmAndRun(
                            "Archive transaction type",
                            "Archiving is permanent - an archived type cannot be reactivated. It stays visible for reference.",
                            () => changeStatus.mutate(status)
                          )
                          return
                        }

                        changeStatus.mutate(status)
                      }}
                    >
                      {TRANSITION_LABELS[status]}
                    </Button>
                  )
                })}

                {!isDeleted && (
                  <Button size="small" onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <TransactionTypeFormModal
        transactionType={transactionType}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onChanged}
      />
    </>
  )
}

export default TransactionTypeDetailDrawer
