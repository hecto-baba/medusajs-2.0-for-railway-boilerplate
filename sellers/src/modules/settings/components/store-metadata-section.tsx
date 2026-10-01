"use client"

import { updateVendorMetadata, type Vendor } from "@lib/data/vendor"
import { PencilSquare, PlusMini, Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { ActionMenu } from "@modules/common"
import { useRouter } from "next/navigation"
import { useState } from "react"

type MetadataPair = {
  key: string
  value: string
}

export const StoreMetadataSection = ({ vendor }: { vendor: Vendor }) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const initialPairs: MetadataPair[] = vendor.metadata
    ? Object.entries(vendor.metadata).map(([key, value]) => ({
        key,
        value: typeof value === "string" ? value : JSON.stringify(value),
      }))
    : []

  const [pairs, setPairs] = useState<MetadataPair[]>(initialPairs)

  const handleOpen = () => {
    setPairs(
      vendor.metadata
        ? Object.entries(vendor.metadata).map(([key, value]) => ({
            key,
            value: typeof value === "string" ? value : JSON.stringify(value),
          }))
        : []
    )
    setOpen(true)
  }

  const handleAddRow = () => {
    setPairs((prev) => [...prev, { key: "", value: "" }])
  }

  const handleRemoveRow = (index: number) => {
    setPairs((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateKey = (index: number, newKey: string) => {
    setPairs((prev) =>
      prev.map((row, i) => (i === index ? { ...row, key: newKey } : row))
    )
  }

  const handleUpdateValue = (index: number, newValue: string) => {
    setPairs((prev) =>
      prev.map((row, i) => (i === index ? { ...row, value: newValue } : row))
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    const newMetadata: Record<string, unknown> = {}

    for (const row of pairs) {
      const trimmedKey = row.key.trim()
      if (trimmedKey) {
        let parsedValue: unknown = row.value
        try {
          if (
            (row.value.startsWith("{") && row.value.endsWith("}")) ||
            (row.value.startsWith("[") && row.value.endsWith("]"))
          ) {
            parsedValue = JSON.parse(row.value)
          }
        } catch {}
        newMetadata[trimmedKey] = parsedValue
      }
    }

    const res = await updateVendorMetadata(
      Object.keys(newMetadata).length > 0 ? newMetadata : null
    )

    setIsSaving(false)
    if (res.success) {
      toast.success("Store metadata updated successfully.")
      setOpen(false)
      router.refresh()
    } else {
      toast.error(res.error || "Failed to update metadata.")
    }
  }

  const hasEntries = initialPairs.length > 0

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Metadata</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Custom key-value pairs stored on your store profile for integrations and automations.
          </Text>
        </div>
        <ActionMenu
          groups={[
            {
              actions: [
                {
                  label: "Edit",
                  icon: <PencilSquare />,
                  onClick: handleOpen,
                },
              ],
            },
          ]}
        />
      </div>

      {hasEntries ? (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell className="w-1/3">Key</Table.HeaderCell>
                <Table.HeaderCell>Value</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {initialPairs.map((pair) => (
                <Table.Row key={pair.key}>
                  <Table.Cell>
                    <Text size="small" weight="plus" className="font-mono text-ui-fg-base">
                      {pair.key}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="font-mono text-ui-fg-subtle truncate max-w-md">
                      {pair.value}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      ) : (
        <div className="flex items-center justify-between px-6 py-4 text-ui-fg-subtle">
          <Text size="small">No metadata configured for this store.</Text>
          <Button size="small" variant="secondary" onClick={handleOpen}>
            <PlusMini /> Add Metadata
          </Button>
        </div>
      )}

      {/* Metadata Edit Drawer */}
      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content className="flex flex-col">
          <Drawer.Header className="border-b p-4">
            <Drawer.Title asChild>
              <Heading level="h2">Edit Metadata</Heading>
            </Drawer.Title>
            <Drawer.Description className="text-ui-fg-subtle text-sm">
              Manage custom key-value metadata attributes for this vendor store.
            </Drawer.Description>
          </Drawer.Header>

          <Drawer.Body className="flex-1 overflow-y-auto p-6 flex flex-col gap-y-4">
            {pairs.length === 0 ? (
              <div className="py-8 text-center text-ui-fg-subtle">
                <Text size="small">No metadata key-value rows yet.</Text>
              </div>
            ) : (
              <div className="flex flex-col gap-y-3">
                {pairs.map((row, index) => (
                  <div key={index} className="flex items-center gap-x-2">
                    <Input
                      size="small"
                      placeholder="Key"
                      value={row.key}
                      onChange={(e) => handleUpdateKey(index, e.target.value)}
                      className="w-1/2 font-mono"
                    />
                    <Input
                      size="small"
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) => handleUpdateValue(index, e.target.value)}
                      className="w-1/2 font-mono"
                    />
                    <Button
                      size="small"
                      variant="transparent"
                      type="button"
                      onClick={() => handleRemoveRow(index)}
                      className="text-ui-fg-muted hover:text-ui-fg-error shrink-0"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={handleAddRow}
              className="self-start mt-2"
            >
              <PlusMini /> Add Row
            </Button>
          </Drawer.Body>

          <Drawer.Footer className="border-t p-4 flex items-center justify-end gap-x-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              isLoading={isSaving}
              onClick={handleSave}
            >
              Save Changes
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
