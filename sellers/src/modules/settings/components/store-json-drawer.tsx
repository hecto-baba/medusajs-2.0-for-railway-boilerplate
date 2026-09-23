"use client"

import { SquareTwoStack, DocumentText } from "@medusajs/icons"
import { Button, Container, Drawer, Heading, Text, toast } from "@medusajs/ui"
import { useState } from "react"

export const StoreJsonDrawer = ({ data }: { data: unknown }) => {
  const [open, setOpen] = useState(false)
  const jsonString = JSON.stringify(data, null, 2)

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString)
    toast.success("JSON copied to clipboard")
  }

  return (
    <Container className="p-0 divide-y">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-2">
          <DocumentText className="h-5 w-5 text-ui-fg-muted" />
          <div>
            <Heading level="h2">Raw JSON</Heading>
            <Text className="text-ui-fg-subtle" size="small">
              Inspect the raw JSON representation of your store entity.
            </Text>
          </div>
        </div>
        <Button size="small" variant="secondary" onClick={() => setOpen(true)}>
          View JSON
        </Button>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content className="flex flex-col">
          <Drawer.Header className="border-b p-4 flex items-center justify-between">
            <div>
              <Drawer.Title asChild>
                <Heading level="h2">Store Data (JSON)</Heading>
              </Drawer.Title>
              <Drawer.Description className="text-ui-fg-subtle text-sm">
                Raw data schema from the backend entity graph.
              </Drawer.Description>
            </div>
            <Button
              size="small"
              variant="secondary"
              onClick={handleCopy}
              className="flex items-center gap-x-1"
            >
              <SquareTwoStack className="h-4 w-4" /> Copy
            </Button>
          </Drawer.Header>

          <Drawer.Body className="flex-1 overflow-y-auto p-4 bg-ui-bg-subtle">
            <pre className="rounded-lg border border-ui-border-base bg-ui-bg-field p-4 text-xs font-mono text-ui-fg-base overflow-x-auto whitespace-pre leading-relaxed">
              {jsonString}
            </pre>
          </Drawer.Body>

          <Drawer.Footer className="border-t p-4 flex justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
