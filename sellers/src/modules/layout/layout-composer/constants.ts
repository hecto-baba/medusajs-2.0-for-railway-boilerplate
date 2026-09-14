/**
 * The single top-bar slot a `LayoutComposer` portals its edit controls into
 * while editing. The matching `LayoutCustomizerSlot` is mounted in the shell's
 * top bar, next to the `CustomizerMenu`.
 */
export const LAYOUT_CONTROLS_LOCATION = "topbar-controls"

/**
 * Stable identifier for each customizable host.
 */
export const CUSTOMIZE_IDS = {
  PAGE: "page",
  TOPBAR: "topbar",
  MAIN_SIDEBAR: "main-sidebar",
  SETTINGS_SIDEBAR: "settings-sidebar",
} as const

export type CustomizeId = (typeof CUSTOMIZE_IDS)[keyof typeof CUSTOMIZE_IDS]

export const CORE_LAYOUT_IDS = {
  SINGLE_COLUMN: "core:single-column",
  SINGLE_ROW: "core:single-row",
  TWO_COLUMN: "core:two-column",
  SETTINGS_SIDEBAR: "core:settings-sidebar",
} as const

export type CoreLayoutId = (typeof CORE_LAYOUT_IDS)[keyof typeof CORE_LAYOUT_IDS]
