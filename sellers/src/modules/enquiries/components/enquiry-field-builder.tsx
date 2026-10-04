"use client"

import type {
  VendorEnquiryFieldDefinition as EnquiryFieldDefinition,
  VendorEnquiryFieldType as EnquiryFieldType,
} from "@lib/data/vendor-client"
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
import { DotsSix, Plus, Trash } from "@medusajs/icons"
import {
  Button,
  Drawer,
  IconButton,
  Input,
  Label,
  Select,
  Switch,
  Text,
  usePrompt,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

/**
 * Field builder for a product's enquiry form. A port of the platform admin's
 * backend/src/admin/components/enquiry-field-builder.tsx (the two apps cannot
 * import from each other) - keep the two in step when one changes.
 */

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
}) => (
  <div className="flex flex-col gap-y-2 pl-8">
    {options.map((option, index) => (
      <div key={index} className="flex items-center gap-x-2">
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
    <div>
      <Button
        size="small"
        variant="secondary"
        type="button"
        onClick={() => onChange([...options, ""])}
      >
        Add option
      </Button>
    </div>
  </div>
)

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
      className="flex flex-col gap-y-3 border-b border-ui-border-base bg-ui-bg-base p-4 last:border-b-0"
    >
      <div className="flex items-center gap-x-3">
        <button
          type="button"
          aria-label="Drag to reorder"
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

        <div className="flex items-center gap-x-1.5">
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

export const EnquiryFieldBuilder = ({
  open,
  onOpenChange,
  initialFields,
  isEnabling,
  isSaving,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialFields: EnquiryFieldDefinition[]
  isEnabling: boolean
  isSaving: boolean
  onSave: (fields: EnquiryFieldDefinition[]) => void
}) => {
  const prompt = usePrompt()
  const [fields, setFields] = useState<EnquiryFieldDefinition[]>([])

  // Reset only when the drawer opens (or the saved fields change underneath
  // it): callers pass a stable `initialFields`, otherwise this would wipe
  // in-progress edits on every parent render.
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

    setFields((current) =>
      arrayMove(
        current,
        current.findIndex((f) => f.id === active.id),
        current.findIndex((f) => f.id === over.id)
      )
    )
  }

  const handleAddField = () =>
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

  const hasEmptyLabel = fields.some((f) => !f.label.trim())
  const hasEmptyOption = fields.some(
    (f) =>
      CHOICE_TYPES.includes(f.type) &&
      (!f.options?.length || f.options.some((o) => !o.trim()))
  )

  const handleSave = async () => {
    // Zero extra fields is valid (email + message only) but easy to do by
    // accident, so ask first.
    if (fields.length === 0) {
      const confirmed = await prompt({
        title: "No extra fields",
        description:
          "Customers will only be asked for their email and a message. Continue?",
        confirmText: "Continue",
        cancelText: "Go back",
      })
      if (!confirmed) return
    }

    // order is re-derived from position, since drag-to-reorder changes the
    // array order, not any single field's order value.
    onSave(fields.map((field, index) => ({ ...field, order: index })))
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{isEnabling ? "Enable Enquiries" : "Edit enquiry fields"}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          <Text size="small" className="text-ui-fg-subtle">
            Every enquiry always asks for an email and a message. Add extra
            fields below to collect more - drag to reorder.
          </Text>

          {fields.length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">
              No extra fields yet - email and message only.
            </Text>
          ) : (
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

          <div>
            <Button size="small" variant="secondary" type="button" onClick={handleAddField}>
              <Plus /> Add field
            </Button>
          </div>

          {(hasEmptyLabel || hasEmptyOption) && (
            <Text size="small" className="text-ui-fg-error">
              Give every field a label, and every dropdown, radio or checkbox
              field at least one non-empty option.
            </Text>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || hasEmptyLabel || hasEmptyOption}
            isLoading={isSaving}
          >
            {isEnabling ? "Enable" : "Save"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
