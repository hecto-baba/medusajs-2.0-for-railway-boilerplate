"use client"

import { createContext } from "react"

export type LayoutCustomizerHostValue = {
  /** DOM node registered for each location, or `null` when unmounted. */
  hosts: Record<string, HTMLElement | null>
  setHost: (location: string, node: HTMLElement | null) => void
  /** Id of the composer currently in edit mode, or `null` when none is. */
  activeEditor: string | null
  setActiveEditor: (id: string | null) => void
  /** `customizeId` of the host the `CustomizerMenu` has asked to enter edit mode */
  editRequest: string | null
  requestEdit: (id: string | null) => void
}

export const LayoutCustomizerHostContext =
  createContext<LayoutCustomizerHostValue | null>(null)
