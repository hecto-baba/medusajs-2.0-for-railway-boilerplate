"use client"

import { EllipsisHorizontal } from "@medusajs/icons"
import { DropdownMenu, IconButton, clx } from "@medusajs/ui"
import Link from "next/link"
import { PropsWithChildren, ReactNode } from "react"

/**
 * The "..." menu that sits in the corner of every settings section header.
 *
 * Ported from the dashboard's components/common/action-menu, with next/link in
 * place of react-router's Link - the markup and classes are otherwise the
 * dashboard's, so the menu reads identically in both panels.
 */

export type Action = {
  icon: ReactNode
  label: string
  disabled?: boolean
} & (
  | { to: string; onClick?: never }
  | { onClick: () => void; to?: never }
)

export type ActionGroup = {
  actions: Action[]
}

type ActionMenuProps = PropsWithChildren<{
  groups: ActionGroup[]
  variant?: "transparent" | "primary"
}>

export const ActionMenu = ({
  groups,
  variant = "transparent",
  children,
}: ActionMenuProps) => {
  const inner = children ?? (
    <IconButton size="small" variant={variant}>
      <EllipsisHorizontal />
    </IconButton>
  )

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>{inner}</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {groups.map((group, index) => {
          if (!group.actions.length) {
            return null
          }

          const isLast = index === groups.length - 1

          return (
            <DropdownMenu.Group key={index}>
              {group.actions.map((action, actionIndex) => {
                if (action.onClick) {
                  return (
                    <DropdownMenu.Item
                      key={actionIndex}
                      disabled={action.disabled}
                      onClick={(event) => {
                        event.stopPropagation()
                        action.onClick?.()
                      }}
                      className={clx(
                        "[&_svg]:text-ui-fg-subtle flex items-center gap-x-2",
                        { "[&_svg]:text-ui-fg-disabled": action.disabled }
                      )}
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </DropdownMenu.Item>
                  )
                }

                return (
                  <DropdownMenu.Item
                    key={actionIndex}
                    className={clx(
                      "[&_svg]:text-ui-fg-subtle flex items-center gap-x-2",
                      { "[&_svg]:text-ui-fg-disabled": action.disabled }
                    )}
                    asChild
                    disabled={action.disabled}
                  >
                    <Link href={action.to!} onClick={(e) => e.stopPropagation()}>
                      {action.icon}
                      <span>{action.label}</span>
                    </Link>
                  </DropdownMenu.Item>
                )
              })}
              {!isLast && <DropdownMenu.Separator />}
            </DropdownMenu.Group>
          )
        })}
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
