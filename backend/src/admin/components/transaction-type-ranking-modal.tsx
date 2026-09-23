import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { DotsSix } from "@medusajs/icons"
import {
  Button,
  FocusModal,
  Heading,
  StatusBadge,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { sdk } from "../lib/sdk"
import {
  STATUS_STYLES,
  TransactionType,
} from "../types/transaction-type"

type RankingModalProps = {
  transactionTypes: TransactionType[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const SortableRow = ({ transactionType }: { transactionType: TransactionType }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: transactionType.id })

  // Fall back rather than index blindly: a status added server-side before
  // this bundle is redeployed would otherwise throw and blank the screen.
  const style = STATUS_STYLES[transactionType.status] ?? {
    label: transactionType.status,
    color: "grey" as const,
    badge: "",
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-3 border-b border-ui-border-base bg-ui-bg-base px-4 py-3 last:border-b-0"
    >
      <button
        type="button"
        className="cursor-grab text-ui-fg-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <DotsSix />
      </button>

      {transactionType.icon_url ? (
        <img
          src={transactionType.icon_url}
          alt=""
          className="size-6 rounded border border-ui-border-base object-cover"
        />
      ) : (
        <div className="size-6 rounded border border-dashed border-ui-border-base" />
      )}

      <div className="flex flex-1 flex-col">
        <Text size="small" weight="plus">
          {transactionType.name}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {transactionType.code}
        </Text>
      </div>

      <StatusBadge color={style.color}>{style.label}</StatusBadge>
    </div>
  )
}

/**
 * Ranking on its own screen rather than as drag handles in the main table.
 *
 * Dragging a row in a list that is searched, filtered or sorted by name is
 * ambiguous - the position an admin drags to does not correspond to a rank.
 * Here the full set is always shown in rank order, so a move means exactly
 * what it looks like. This mirrors how the core admin handles category
 * ranking.
 */
export const TransactionTypeRankingModal = ({
  transactionTypes,
  open,
  onOpenChange,
  onSaved,
}: RankingModalProps) => {
  const [items, setItems] = useState<TransactionType[]>([])

  useEffect(() => {
    if (open) {
      setItems([...transactionTypes].sort((a, b) => a.rank - b.rank))
    }
  }, [open, transactionTypes])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/transaction-types/reorder", {
        method: "POST",
        body: { ids: items.map((item) => item.id) },
      }),
    onSuccess: () => {
      toast.success("Order saved")
      onOpenChange(false)
      onSaved()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not save the new order")
    },
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    setItems((current) => {
      const from = current.findIndex((item) => item.id === active.id)
      const to = current.findIndex((item) => item.id === over.id)

      return arrayMove(current, from, to)
    })
  }

  // Sorted once per change rather than inside the comparison callback, where
  // it was re-sorting the whole list for every item on every render.
  const originalOrder = useMemo(
    () => [...transactionTypes].sort((a, b) => a.rank - b.rank),
    [transactionTypes]
  )

  const isDirty = items.some(
    (item, index) => item.id !== originalOrder[index]?.id
  )

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              size="small"
              onClick={() => save.mutate()}
              isLoading={save.isPending}
              disabled={!isDirty}
            >
              Save order
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-10">
          <div className="flex w-full max-w-2xl flex-col gap-6 px-6">
            <div>
              <Heading level="h2">Organize ranking</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Drag to set the order transaction types are shown in. Nothing
                else about them changes.
              </Text>
            </div>

            {!items.length ? (
              <Text size="small" className="text-ui-fg-subtle">
                Nothing to reorder yet.
              </Text>
            ) : (
              <div className="overflow-hidden rounded-lg border border-ui-border-base">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={items.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {items.map((item) => (
                      <SortableRow key={item.id} transactionType={item} />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

export default TransactionTypeRankingModal
