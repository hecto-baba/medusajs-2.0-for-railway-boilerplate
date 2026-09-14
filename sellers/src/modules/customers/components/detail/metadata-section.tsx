"use client"

import { Container, Heading, Text } from "@medusajs/ui"

type MetadataSectionProps = {
  metadata?: Record<string, unknown> | null
}

export const MetadataSection = ({ metadata }: MetadataSectionProps) => {
  const hasMetadata = metadata && Object.keys(metadata).length > 0

  return (
    <Container className="p-6">
      <div className="border-b pb-4 mb-4">
        <Heading level="h2">Metadata</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Custom metadata key-value pairs stored on this record.
        </Text>
      </div>

      {!hasMetadata ? (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            No metadata attached to this customer.
          </Text>
        </div>
      ) : (
        <div className="rounded-lg border bg-ui-bg-subtle p-4 font-mono text-xs overflow-x-auto">
          <pre>{JSON.stringify(metadata, null, 2)}</pre>
        </div>
      )}
    </Container>
  )
}
