"use client"

import { Container, Heading, Text } from "@medusajs/ui"
import type { ReactNode } from "react"

/**
 * The card shell every detail section sits in.
 *
 * Mirrors the admin's Container + header layout so the sections line up
 * visually with the rest of the panel rather than each inventing its own
 * spacing.
 */
export const Section = ({
  title,
  actions,
  children,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
}) => (
  <Container className="divide-y p-0">
    <div className="flex items-center justify-between px-6 py-4">
      <Heading level="h2">{title}</Heading>
      {actions ? <div className="flex items-center gap-x-2">{actions}</div> : null}
    </div>
    {children}
  </Container>
)

/**
 * A label/value row, as used by the admin's General and Attributes cards.
 * An empty value renders as a dash rather than collapsing, so the row still
 * reads as "this field exists and is unset".
 */
export const Row = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
    <Text size="small" weight="plus" className="text-ui-fg-base">
      {label}
    </Text>
    <div className="text-ui-fg-subtle txt-small">
      {children === null || children === undefined || children === "" ? (
        <span className="text-ui-fg-muted">-</span>
      ) : (
        children
      )}
    </div>
  </div>
)
