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
import { DotsSix, Trash, Plus } from "@medusajs/icons"
import {
  Button,
  Drawer,
  Input,
  Label,
  Select,
  Switch,
  Text,
  IconButton,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

export type EnquiryFieldType =
  | "text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "dropdown"
  | "radio"
  | "checkbox"

export type EnquiryFieldDefinition = {
  id: string
  type: EnquiryFieldType
  label: string
  required: boolean
  order: number
  options?: string[]
}

const FIELD_TYPE_LABEL: Record<EnquiryFieldType, string> = {
  text: "Text",
  long_text: "Long text",
  email: "Email",
  phone: "Phone (E.164)",
  number: "Number",
  dropdown: "Dropdown",
  radio: "Radio buttons",
  checkbox: "Checkboxes",
}

const CHOICE_TYPES: EnquiryFieldType[] = ["dropdown", "radio", "checkbox"]

const generateFieldId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const OptionsEditor = ({
  options,
  onChange,
}: {
  options: string[]
  onChange: (options: string[]) => void
}) => {
  return (
    <div className="space-y-2 pl-8">
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            size="small"
            value={option}
            placeholder={`Option ${index + 1}`}
            onChange={(e) => {
              const next = [...options]
              next[index] = e.target.value
              onChange(next)
            }}
          />
          <IconButton
            size="small"
            variant="transparent"
            type="button"
            onClick={() => onChange(options.filter((_, i) => i !== index))}
          >
            <Trash />
          </IconButton>
        </div>
      ))}
      <Button
        size="small"
        variant="secondary"
        type="button"
        onClick={() => onChange([...options, ""])}
      >
        Add option
      </Button>
    </div>
  )
}

const SortableFieldRow = ({
  field,
  onChange,
  onRemove,
}: {
  field: EnquiryFieldDefinition
  onChange: (field: EnquiryFieldDefinition) => void
  onRemove: () => void
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="space-y-3 border-b border-ui-border-base bg-ui-bg-base p-4 last:border-b-0"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="cursor-grab text-ui-fg-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <DotsSix />
        </button>

        <Input
          size="small"
          value={field.label}
          placeholder="Field label"
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          className="flex-1"
        />

        <Select
          size="small"
          value={field.type}
          onValueChange={(value) => {
            const type = value as EnquiryFieldType
            onChange({
              ...field,
              type,
              options: CHOICE_TYPES.includes(type) ? field.options ?? [""] : undefined,
            })
          }}
        >
          <Select.Trigger className="w-44">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {Object.entries(FIELD_TYPE_LABEL).map(([value, label]) => (
              <Select.Item key={value} value={value}>
                {label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>

        <div className="flex items-center gap-1.5">
          <Switch
            id={`required-${field.id}`}
            checked={field.required}
            onCheckedChange={(checked) => onChange({ ...field, required: checked })}
          />
          <Label htmlFor={`required-${field.id}`} className="text-ui-fg-subtle">
            Required
          </Label>
        </div>

        <IconButton size="small" variant="transparent" type="button" onClick={onRemove}>
          <Trash />
        </IconButton>
      </div>

      {CHOICE_TYPES.includes(field.type) && (
        <OptionsEditor
          options={field.options ?? []}
          onChange={(options) => onChange({ ...field, options })}
        />
      )}
    </div>
  )
}

type EnquiryFieldBuilderProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialFields: EnquiryFieldDefinition[]
  isEnabling: boolean
  isSaving: boolean
  onSave: (fields: EnquiryFieldDefinition[]) => void
}

/**
 * Field-builder Drawer for EnquiryConfiguration.custom_fields - drag-to-
 * reorder reuses the same dnd-kit structure as
 * transaction-type-ranking-modal.tsx (the simple single-list pattern, not
 * LayoutComposer's multi-zone one). See
 * docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md, Phase E.3.
 */
export const EnquiryFieldBuilder = ({
  open,
  onOpenChange,
  initialFields,
  isEnabling,
  isSaving,
  onSave,
}: EnquiryFieldBuilderProps) => {
  const [fields, setFields] = useState<EnquiryFieldDefinition[]>([])

  useEffect(() => {
    if (open) {
      setFields([...initialFields].sort((a, b) => a.order - b.order))
    }
  }, [open, initialFields])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setFields((current) => {
      const from = current.findIndex((f) => f.id === active.id)
      const to = current.findIndex((f) => f.id === over.id)
      return arrayMove(current, from, to)
    })
  }

  const handleAddField = () => {
    setFields((current) => [
      ...current,
      {
        id: generateFieldId(),
        type: "text",
        label: "",
        required: false,
        order: current.length,
      },
    ])
  }

  const handleSave = () => {
    // order is re-derived from array position on save, since drag-to-reorder
    // changes array position, not any single field's order value directly.
    const ordered = fields.map((field, index) => ({ ...field, order: index }))
    onSave(ordered)
  }

  const hasEmptyLabel = fields.some((f) => !f.label.trim())

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{isEnabling ? "Enable Enquiries" : "Edit enquiry fields"}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="space-y-4">
          <Text size="small" className="text-ui-fg-subtle">
            Every enquiry always asks for an email and a message. Add extra
            fields below if you want to collect more - drag to reorder.
          </Text>

          {fields.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              No extra fields yet - email and message only.
            </Text>
          )}

          {fields.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-ui-border-base">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {fields.map((field) => (
                    <SortableFieldRow
                      key={field.id}
                      field={field}
                      onChange={(updated) =>
                        setFields((current) =>
                          current.map((f) => (f.id === updated.id ? updated : f))
                        )
                      }
                      onRemove={() =>
                        setFields((current) => current.filter((f) => f.id !== field.id))
                      }
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}

          <Button size="small" variant="secondary" type="button" onClick={handleAddField}>
            <Plus /> Add field
          </Button>
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || hasEmptyLabel}
              isLoading={isSaving}
            >
              {isEnabling ? "Enable" : "Save"}
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

export default EnquiryFieldBuilder
