"use client"

import {
  BellAlert,
  BellAlertDone,
  InformationCircleSolid,
} from "@medusajs/icons"
import { clx, Drawer, Heading, IconButton, Text, Tooltip } from "@medusajs/ui"
import { formatDistance } from "date-fns"
import React, { useEffect, useState } from "react"

export interface VendorNotificationItem {
  id: string
  to?: string
  channel?: string
  template?: string
  data?: {
    title?: string
    description?: string
    file?: {
      filename?: string
      url?: string
      mimeType?: string
    }
  } | null
  created_at: string
  updated_at?: string
}

const LAST_READ_NOTIFICATION_KEY = "vendor_notifications_last_read_at"

export const Notifications = () => {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<VendorNotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)

  // Initialize last read timestamp from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_READ_NOTIFICATION_KEY)
      setLastReadAt(stored)
    } catch {
      // ignore
    }
  }, [])

  // Keyboard shortcut: Cmd+N or Ctrl+N to toggle notifications drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  // Fetch notifications
  const fetchNotifications = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/vendors/notifications?limit=50")
      if (res.ok) {
        const data = await res.json()
        const list: VendorNotificationItem[] = data.notifications || []
        setNotifications(list)

        // Check if there are any unread notifications
        const lastReadTimestamp = lastReadAt ? Date.parse(lastReadAt) : 0
        const unreadExists = list.some(
          (n) => Date.parse(n.created_at) > lastReadTimestamp
        )
        setHasUnread(unreadExists)
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false)
    }
  }, [lastReadAt])

  // Initial fetch and 60-second polling
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const handleOpenChange = (shouldOpen: boolean) => {
    if (shouldOpen) {
      setHasUnread(false)
      setOpen(true)
      const now = new Date().toISOString()
      try {
        localStorage.setItem(LAST_READ_NOTIFICATION_KEY, now)
      } catch {
        // ignore
      }
      fetchNotifications()
    } else {
      setOpen(false)
      try {
        setLastReadAt(localStorage.getItem(LAST_READ_NOTIFICATION_KEY))
      } catch {
        // ignore
      }
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <Tooltip content="Notifications (⌘N)">
        <Drawer.Trigger asChild>
          <IconButton
            variant="transparent"
            size="small"
            aria-label="Notifications"
            className="text-ui-fg-muted hover:text-ui-fg-subtle relative"
          >
            {hasUnread ? <BellAlertDone /> : <BellAlert />}
            {hasUnread && (
              <span className="bg-ui-bg-interactive absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-white" />
            )}
          </IconButton>
        </Drawer.Trigger>
      </Tooltip>

      <Drawer.Content className="max-w-md">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Notifications</Heading>
          </Drawer.Title>
          <Drawer.Description className="sr-only">
            View system alerts and vendor notifications feed
          </Drawer.Description>
        </Drawer.Header>

        <Drawer.Body className="overflow-y-auto px-0">
          {notifications.length === 0 ? (
            <NotificationsEmptyState />
          ) : (
            <div className="divide-ui-border-base divide-y">
              {notifications.map((notification) => {
                const unread =
                  Date.parse(notification.created_at) >
                  (lastReadAt ? Date.parse(lastReadAt) : 0)

                return (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    unread={unread}
                  />
                )
              })}
            </div>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}

const NotificationRow = ({
  notification,
  unread,
}: {
  notification: VendorNotificationItem
  unread?: boolean
}) => {
  const data = notification.data
  const title = data?.title || "System Notification"
  const description = data?.description

  return (
    <div className="relative flex items-start justify-start gap-3 p-4 transition-colors hover:bg-ui-bg-subtle">
      <div className="text-ui-fg-muted mt-0.5 flex size-5 shrink-0 items-center justify-center">
        <InformationCircleSolid />
      </div>

      <div className="flex flex-1 flex-col gap-y-1">
        <div className="flex items-center justify-between gap-x-2">
          <Text size="small" leading="compact" weight="plus" className="text-ui-fg-base">
            {title}
          </Text>

          <div className="flex items-center gap-x-1.5 shrink-0">
            <Text
              size="xsmall"
              leading="compact"
              className={clx(
                unread ? "text-ui-fg-base font-medium" : "text-ui-fg-muted"
              )}
            >
              {formatDistance(new Date(notification.created_at), new Date(), {
                addSuffix: true,
              })}
            </Text>
            {unread && (
              <span
                className="bg-ui-bg-interactive h-2 w-2 rounded-full"
                role="status"
                title="Unread"
              />
            )}
          </div>
        </div>

        {description && (
          <Text
            size="small"
            className="text-ui-fg-subtle whitespace-pre-line leading-normal"
          >
            {description}
          </Text>
        )}

        {data?.file?.url && (
          <a
            href={data.file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ui-fg-interactive hover:underline mt-1 text-xs"
          >
            {data.file.filename || "Attached document"}
          </a>
        )}
      </div>
    </div>
  )
}

const NotificationsEmptyState = () => {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center p-6 text-center">
      <div className="text-ui-fg-muted flex size-12 items-center justify-center rounded-full bg-ui-bg-subtle">
        <BellAlertDone className="h-6 w-6" />
      </div>
      <Text size="small" weight="plus" className="text-ui-fg-base mt-4">
        No notifications
      </Text>
      <Text size="small" className="text-ui-fg-muted mt-1 max-w-[260px]">
        You don&apos;t have any notifications right now. Alerts and updates will appear here.
      </Text>
    </div>
  )
}
