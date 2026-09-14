import { ReactNode } from "react"
import { CORE_LAYOUT_IDS } from "./constants"

export type WidgetPreference = {
  order?: number
  hidden?: boolean
  section?: string
}

export type LayoutPreference = {
  widgets: Record<string, WidgetPreference>
}

export type LayoutScope = "personal" | "default"

export type LayoutControlSize = "xsmall" | "small" | "default"

export type LayoutSectionOrdering =
  | "list"
  | "grid"
  | "horizontal-list"
  | "horizontal-stretched"

export type LayoutSection = {
  id: string
  ordering?: LayoutSectionOrdering
}

export type LayoutDefinition = {
  id: string
  sections: LayoutSection[]
  Component?: React.ComponentType<any>
}

export type RawEntry = {
  widgetId: string
  render: (data?: any) => ReactNode
  naturalSection: string
}

export type DisplayEntry = {
  widgetId: string
  render: (data?: any) => ReactNode
  naturalSection: string
  order: number
  hidden: boolean
}

export type SectionNameFor<TLayoutId extends string> = TLayoutId extends typeof CORE_LAYOUT_IDS.TWO_COLUMN
  ? "main" | "side"
  : TLayoutId extends typeof CORE_LAYOUT_IDS.SETTINGS_SIDEBAR
  ? "general" | "developer" | "myAccount" | "extensions" | "productOrg" | "fulfillment"
  : "main"
