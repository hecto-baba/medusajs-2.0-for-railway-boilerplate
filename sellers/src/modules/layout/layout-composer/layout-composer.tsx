"use client"

import { DndContext, DragOverlay } from "@dnd-kit/core"
import { Badge, Button, clx } from "@medusajs/ui"
import React, {
  Children,
  ComponentType,
  Fragment,
  isValidElement,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react"
import { createPortal } from "react-dom"
import {
  CUSTOMIZE_IDS,
  LAYOUT_CONTROLS_LOCATION,
  CORE_LAYOUT_IDS,
} from "./constants"
import {
  useLayoutCustomizerActiveEditor,
  useLayoutCustomizerTriggerHost,
  useLayoutEditRequest,
} from "./customizer-host-provider"
import { SectionDropzone } from "./section-dropzone"
import { EntryContent, SortableEntry } from "./sortable-entry"
import type {
  DisplayEntry,
  LayoutControlSize,
  LayoutPreference,
  LayoutSection,
  RawEntry,
} from "./types"
import { useLayoutDnd } from "./use-layout-dnd"
import { useLayoutPreference } from "./use-layout-preference"

export type LayoutEntryProps = {
  id: string
  children: ReactNode
}

export const LayoutEntry = ({ children }: LayoutEntryProps) => {
  return <>{children}</>
}

export type LayoutComposerProps = {
  widgetsZonePrefix: string
  preferredLayoutId?: string
  sections: Record<string, ReactNode>
  data?: any
  hasOutlet?: boolean
  customizeId?: string
  controlSize?: LayoutControlSize
  disableWidgets?: boolean
  layoutProps?: {
    className?: string
  }
}

function extractEntriesFromSection(
  sectionNode: ReactNode,
  sectionId: string
): RawEntry[] {
  const entries: RawEntry[] = []

  const processChild = (child: ReactNode) => {
    if (!child) return
    if (!isValidElement(child)) return

    // If it's a React Fragment, flatten its children
    if (child.type === Fragment) {
      Children.forEach((child.props as any).children, processChild)
      return
    }

    const props = (child as ReactElement<any>).props
    const widgetId = props?.id || child.key || `entry-${entries.length}`

    entries.push({
      widgetId: String(widgetId),
      render: () => props?.children ?? child,
      naturalSection: sectionId,
    })
  }

  if (isValidElement(sectionNode) && sectionNode.type === Fragment) {
    Children.forEach((sectionNode.props as any).children, processChild)
  } else if (Array.isArray(sectionNode)) {
    sectionNode.forEach(processChild)
  } else if (sectionNode) {
    processChild(sectionNode)
  }

  return entries
}

export const LayoutComposer = ({
  widgetsZonePrefix,
  preferredLayoutId = CORE_LAYOUT_IDS.SINGLE_COLUMN,
  sections,
  customizeId = CUSTOMIZE_IDS.PAGE,
  controlSize = "default",
  layoutProps = {},
}: LayoutComposerProps) => {
  const {
    personalPreference,
    setPreference,
    resetPreference,
    isSaving,
  } = useLayoutPreference(widgetsZonePrefix)

  const controlsHost = useLayoutCustomizerTriggerHost(LAYOUT_CONTROLS_LOCATION)
  const { activeEditor, setActiveEditor } = useLayoutCustomizerActiveEditor()
  const { editRequest, requestEdit } = useLayoutEditRequest()
  const editorId = useId()

  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<LayoutPreference | null>(null)

  // Listen for edit requests directed to this composer
  useEffect(() => {
    if (editRequest === customizeId && !editMode) {
      requestEdit(null)
      setEditMode(true)
      setActiveEditor(editorId)
      setDraft(personalPreference)
    }
  }, [editRequest, customizeId, editMode, editorId, personalPreference, requestEdit, setActiveEditor])

  // Clear active editor on unmount
  useEffect(() => {
    return () => {
      setActiveEditor(null)
    }
  }, [setActiveEditor])

  const activePreference: LayoutPreference = useMemo(() => {
    return editMode && draft ? draft : personalPreference
  }, [editMode, draft, personalPreference])

  const cancelEdit = useCallback(() => {
    setDraft(null)
    setEditMode(false)
    setActiveEditor(null)
  }, [setActiveEditor])

  const saveEdit = useCallback(() => {
    if (draft) {
      setPreference(draft, undefined, () => {
        setEditMode(false)
        setActiveEditor(null)
        setDraft(null)
      })
    } else {
      setEditMode(false)
      setActiveEditor(null)
    }
  }, [draft, setPreference, setActiveEditor])

  // Build display entries
  const { entriesBySection, widgetSectionMap, validSectionIds } =
    useMemo(() => {
      const rawEntries: RawEntry[] = []
      const sectionKeys = Object.keys(sections)

      for (const sectionKey of sectionKeys) {
        rawEntries.push(
          ...extractEntriesFromSection(sections[sectionKey], sectionKey)
        )
      }

      const validSectionIds = new Set(sectionKeys)
      const entriesBySection: Record<string, DisplayEntry[]> = {}

      for (const sec of sectionKeys) {
        entriesBySection[sec] = []
      }

      // Group entries and apply preference overrides
      for (let i = 0; i < rawEntries.length; i++) {
        const raw = rawEntries[i]
        const pref = activePreference.widgets[raw.widgetId]
        const targetSection =
          pref?.section && validSectionIds.has(pref.section)
            ? pref.section
            : raw.naturalSection
        const order = pref?.order ?? i
        const hidden = pref?.hidden ?? false

        if (!entriesBySection[targetSection]) {
          entriesBySection[targetSection] = []
        }

        entriesBySection[targetSection].push({
          widgetId: raw.widgetId,
          render: raw.render,
          naturalSection: raw.naturalSection,
          order,
          hidden,
        })
      }

      // Sort entries by order within each section
      for (const sec of sectionKeys) {
        entriesBySection[sec].sort((a, b) => a.order - b.order)
      }

      const widgetSectionMap: Record<string, string> = {}
      for (const [sectionId, entries] of Object.entries(entriesBySection)) {
        for (const e of entries) {
          widgetSectionMap[e.widgetId] = sectionId
        }
      }

      return { entriesBySection, widgetSectionMap, validSectionIds }
    }, [sections, activePreference])

  const {
    sensors,
    collisionDetection,
    activeEntry,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useLayoutDnd({
    entriesBySection,
    widgetSectionMap,
    validSectionIds,
    setDraft,
  })

  const toggleHidden = useCallback(
    (widgetId: string) => {
      setDraft((prev) => {
        const currentWidgets = prev?.widgets ?? {}
        const isHidden = currentWidgets[widgetId]?.hidden ?? false
        return {
          widgets: {
            ...currentWidgets,
            [widgetId]: {
              ...currentWidgets[widgetId],
              hidden: !isHidden,
            },
          },
        }
      })
    },
    [setDraft]
  )

  const isTwoColumn =
    preferredLayoutId === CORE_LAYOUT_IDS.TWO_COLUMN ||
    Boolean(sections.main && sections.side)

  const sectionKeys = Object.keys(sections)

  // Topbar portal controls when in edit mode
  const editControls = editMode && controlsHost && (
    createPortal(
      <div className="flex items-center gap-x-2 animate-in fade-in duration-200">
        <Badge size="small" rounded="full" className="bg-ui-bg-subtle text-ui-fg-muted font-normal">
          Personal layout
        </Badge>
        <Button
          size="small"
          variant="secondary"
          type="button"
          onClick={cancelEdit}
          disabled={isSaving}
        >
          Discard changes
        </Button>
        <Button
          size="small"
          variant="primary"
          type="button"
          onClick={saveEdit}
          isLoading={isSaving}
        >
          Save
        </Button>
      </div>,
      controlsHost
    )
  )

  if (!editMode) {
    if (isTwoColumn) {
      return (
        <>
          {editControls}
          <div
            className={clx(
              "flex flex-col gap-6 xl:flex-row xl:items-start",
              layoutProps.className
            )}
          >
            <div className="flex w-full flex-col gap-6 xl:max-w-4xl">
              {(entriesBySection.main || [])
                .filter((e) => !e.hidden)
                .map((entry) => (
                  <Fragment key={entry.widgetId}>{entry.render()}</Fragment>
                ))}
            </div>
            <div className="flex w-full flex-col gap-6 xl:max-w-sm">
              {(entriesBySection.side || [])
                .filter((e) => !e.hidden)
                .map((entry) => (
                  <Fragment key={entry.widgetId}>{entry.render()}</Fragment>
                ))}
            </div>
          </div>
        </>
      )
    }

    return (
      <>
        {editControls}
        <div className={clx("flex flex-col gap-y-2", layoutProps.className)}>
          {sectionKeys.map((sectionKey) => {
            const visibleEntries = (entriesBySection[sectionKey] || []).filter(
              (e) => !e.hidden
            )
            return (
              <Fragment key={sectionKey}>
                {visibleEntries.map((entry) => (
                  <Fragment key={entry.widgetId}>{entry.render()}</Fragment>
                ))}
              </Fragment>
            )
          })}
        </div>
      </>
    )
  }

  if (isTwoColumn) {
    return (
      <>
        {editControls}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div
            className={clx(
              "flex flex-col gap-6 xl:flex-row xl:items-start",
              layoutProps.className
            )}
          >
            <div className="flex w-full flex-col gap-6 xl:max-w-4xl">
              <SectionDropzone
                section={{ id: "main", ordering: "list" }}
                items={(entriesBySection.main || []).map((e) => e.widgetId)}
              >
                {(entriesBySection.main || []).map((entry) => (
                  <SortableEntry
                    key={entry.widgetId}
                    widgetId={entry.widgetId}
                    order={entry.order}
                    hidden={entry.hidden}
                    onToggleHidden={() => toggleHidden(entry.widgetId)}
                    controlSize={controlSize}
                  >
                    {entry.render()}
                  </SortableEntry>
                ))}
              </SectionDropzone>
            </div>
            <div className="flex w-full flex-col gap-6 xl:max-w-sm">
              <SectionDropzone
                section={{ id: "side", ordering: "list" }}
                items={(entriesBySection.side || []).map((e) => e.widgetId)}
              >
                {(entriesBySection.side || []).map((entry) => (
                  <SortableEntry
                    key={entry.widgetId}
                    widgetId={entry.widgetId}
                    order={entry.order}
                    hidden={entry.hidden}
                    onToggleHidden={() => toggleHidden(entry.widgetId)}
                    controlSize={controlSize}
                  >
                    {entry.render()}
                  </SortableEntry>
                ))}
              </SectionDropzone>
            </div>
          </div>

          <DragOverlay>
            {activeEntry ? (
              <div className="ring-ui-border-interactive bg-ui-bg-base opacity-90 shadow-elevation-card-hover rounded-lg ring-2">
                <EntryContent>{activeEntry.render()}</EntryContent>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </>
    )
  }

  return (
    <>
      {editControls}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className={clx("flex flex-col gap-y-2", layoutProps.className)}>
          {sectionKeys.map((sectionKey) => {
            const sectionEntries = entriesBySection[sectionKey] || []
            const itemIds = sectionEntries.map((e) => e.widgetId)
            const sectionDef: LayoutSection = { id: sectionKey, ordering: "list" }

            return (
              <SectionDropzone
                key={sectionKey}
                section={sectionDef}
                items={itemIds}
              >
                {sectionEntries.map((entry) => (
                  <SortableEntry
                    key={entry.widgetId}
                    widgetId={entry.widgetId}
                    order={entry.order}
                    hidden={entry.hidden}
                    onToggleHidden={() => toggleHidden(entry.widgetId)}
                    controlSize={controlSize}
                  >
                    {entry.render()}
                  </SortableEntry>
                ))}
              </SectionDropzone>
            )
          })}
        </div>

        <DragOverlay>
          {activeEntry ? (
            <div className="ring-ui-border-interactive bg-ui-bg-base opacity-90 shadow-elevation-card-hover rounded-lg ring-2">
              <EntryContent>{activeEntry.render()}</EntryContent>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}

LayoutComposer.Entry = LayoutEntry
