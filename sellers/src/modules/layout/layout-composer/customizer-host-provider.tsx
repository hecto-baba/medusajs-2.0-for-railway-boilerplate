"use client"

import React, {
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import {
  LayoutCustomizerHostContext,
  type LayoutCustomizerHostValue,
} from "./customizer-host-context"
import { LAYOUT_CONTROLS_LOCATION } from "./constants"

export const LayoutCustomizerHostProvider = ({
  children,
}: {
  children: ReactNode
}) => {
  const [hosts, setHosts] = useState<Record<string, HTMLElement | null>>({})
  const [activeEditor, setActiveEditor] = useState<string | null>(null)
  const [editRequest, setEditRequest] = useState<string | null>(null)

  const setHost = useCallback((location: string, node: HTMLElement | null) => {
    setHosts((prev) => {
      if (prev[location] === node) {
        return prev
      }
      return { ...prev, [location]: node }
    })
  }, [])

  const value: LayoutCustomizerHostValue = useMemo(
    () => ({
      hosts,
      setHost,
      activeEditor,
      setActiveEditor,
      editRequest,
      requestEdit: setEditRequest,
    }),
    [hosts, setHost, activeEditor, editRequest]
  )

  return (
    <LayoutCustomizerHostContext.Provider value={value}>
      {children}
    </LayoutCustomizerHostContext.Provider>
  )
}

export const useLayoutCustomizerHost = () => {
  const ctx = useContext(LayoutCustomizerHostContext)
  if (!ctx) {
    throw new Error(
      "useLayoutCustomizerHost must be used within LayoutCustomizerHostProvider"
    )
  }
  return ctx
}

export const useLayoutCustomizerActiveEditor = () => {
  const ctx = useContext(LayoutCustomizerHostContext)
  return {
    activeEditor: ctx?.activeEditor ?? null,
    setActiveEditor: ctx?.setActiveEditor ?? (() => {}),
  }
}

export const useLayoutEditRequest = () => {
  const ctx = useContext(LayoutCustomizerHostContext)
  return {
    editRequest: ctx?.editRequest ?? null,
    requestEdit: ctx?.requestEdit ?? (() => {}),
  }
}

export const useLayoutCustomizerTriggerHost = (
  location: string = LAYOUT_CONTROLS_LOCATION
) => {
  const ctx = useContext(LayoutCustomizerHostContext)
  return ctx?.hosts[location] ?? null
}

export const LayoutCustomizerSlot = ({
  location = LAYOUT_CONTROLS_LOCATION,
  className = "contents",
}: {
  location?: string
  className?: string
}) => {
  const ctx = useContext(LayoutCustomizerHostContext)
  const setHost = ctx?.setHost
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      setHost?.(location, el)
    },
    [setHost, location]
  )
  return <div ref={ref} className={className} />
}
