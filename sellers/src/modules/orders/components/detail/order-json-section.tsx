"use client"

import { ArrowUpRightOnBox, XMarkMini } from "@medusajs/icons"
import { Badge, Container, Drawer, Heading, IconButton, Kbd } from "@medusajs/ui"

/**
 * The JSON card - the admin's JsonViewSection: the heading, a "N keys" badge
 * and a drawer with the raw record. Read-only, and shows what the seller's
 * order route returned (own items only), not the whole order.
 */
export const OrderJsonSection = ({ data }: { data: object }) => {
  const numberOfKeys = Object.keys(data).length

  return (
    <Container className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-x-4">
        <Heading level="h2">JSON</Heading>
        <Badge size="2xsmall" rounded="full">
          {numberOfKeys} {numberOfKeys === 1 ? "key" : "keys"}
        </Badge>
      </div>
      <Drawer>
        <Drawer.Trigger asChild>
          <IconButton size="small" variant="transparent" className="text-ui-fg-muted hover:text-ui-fg-subtle">
            <ArrowUpRightOnBox />
          </IconButton>
        </Drawer.Trigger>
        <Drawer.Content className="bg-ui-bg-base text-ui-fg-base overflow-hidden border max-w-lg">
          <Drawer.Header className="flex items-center justify-between border-b px-6 py-4">
            <Drawer.Title asChild>
              <Heading level="h2">JSON ({numberOfKeys})</Heading>
            </Drawer.Title>
            <div className="flex items-center gap-x-2">
              <Kbd>esc</Kbd>
              <Drawer.Close asChild>
                <IconButton size="small" variant="transparent">
                  <XMarkMini />
                </IconButton>
              </Drawer.Close>
            </div>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto p-6">
            <div className="bg-ui-bg-subtle overflow-x-auto rounded-lg border p-4 font-mono text-xs">
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </div>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
