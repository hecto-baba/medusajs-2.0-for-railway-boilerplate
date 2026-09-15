"use client"

import {
  ArrowUpRightOnBox,
  XMarkMini,
} from "@medusajs/icons"
import {
  Badge,
  Container,
  Drawer,
  Heading,
  IconButton,
  Kbd,
  Text,
} from "@medusajs/ui"

type MetadataSectionProps = {
  metadata?: Record<string, unknown> | null
}

export const MetadataSection = ({ metadata }: MetadataSectionProps) => {
  const numberOfKeys = metadata ? Object.keys(metadata).length : 0

  return (
    <Container className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-x-3">
        <Heading level="h2">Metadata</Heading>
        <Badge size="2xsmall" rounded="full">
          {numberOfKeys} {numberOfKeys === 1 ? "key" : "keys"}
        </Badge>
      </div>

      <Drawer>
        <Drawer.Trigger asChild>
          <IconButton
            size="small"
            variant="transparent"
            className="text-ui-fg-muted hover:text-ui-fg-subtle"
          >
            <ArrowUpRightOnBox />
          </IconButton>
        </Drawer.Trigger>
        <Drawer.Content className="bg-ui-bg-base text-ui-fg-base overflow-hidden border max-w-lg">
          <Drawer.Header className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-x-3">
              <Drawer.Title asChild>
                <Heading level="h2">
                  Metadata ({numberOfKeys})
                </Heading>
              </Drawer.Title>
            </div>
            <div className="flex items-center gap-x-2">
              <Kbd>esc</Kbd>
              <Drawer.Close asChild>
                <IconButton size="small" variant="transparent">
                  <XMarkMini />
                </IconButton>
              </Drawer.Close>
            </div>
          </Drawer.Header>
          <Drawer.Body className="p-6 overflow-y-auto">
            {!metadata || numberOfKeys === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <Text size="small" className="text-ui-fg-subtle">
                  No metadata stored on this record.
                </Text>
              </div>
            ) : (
              <div className="rounded-lg border bg-ui-bg-subtle p-4 font-mono text-xs overflow-x-auto">
                <pre>{JSON.stringify(metadata, null, 2)}</pre>
              </div>
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
