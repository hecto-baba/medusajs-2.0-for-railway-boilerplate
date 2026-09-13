"use client"

import {
  confirmVendorProductImport,
  startVendorProductImport,
  uploadVendorImportFile,
} from "@lib/data/vendor-client"
import { Button, FocusModal, Heading, Text, toast } from "@medusajs/ui"
import { useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"

type Stage =
  | { name: "idle" }
  | { name: "uploading" }
  | {
      name: "ready"
      transactionId: string
      filename: string
      toCreate: number
      toUpdate: number
    }
  | { name: "confirming" }

/**
 * Two-step CSV import, matching the admin's flow.
 *
 * The file is uploaded and parsed first, and the create/update counts are
 * shown before anything is written - an import that silently rewrote a
 * catalogue would be unrecoverable, and the vendor has no undo.
 *
 * Note that products created by an import are not currently linked to the
 * vendor (the rows are written by a background step with no request context),
 * so they will not appear in this list afterwards. The copy below says so
 * rather than leaving the vendor to discover it.
 */
export const ProductImportModal = () => {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>({ name: "idle" })

  const reset = () => setStage({ name: "idle" })

  const onFile = async (file: File) => {
    if (!/\.csv$/i.test(file.name)) {
      toast.error("Only .csv files can be imported.")
      return
    }

    setStage({ name: "uploading" })

    try {
      const uploaded = await uploadVendorImportFile(file)

      const result = await startVendorProductImport({
        file_key: uploaded.id,
        originalname: file.name,
        extension: "csv",
        size: file.size,
        mime_type: file.type || "text/csv",
      })

      setStage({
        name: "ready",
        transactionId: result.transaction_id,
        filename: file.name,
        toCreate: result.summary?.toCreate ?? 0,
        toUpdate: result.summary?.toUpdate ?? 0,
      })
    } catch (error) {
      reset()
      toast.error(
        error instanceof Error ? error.message : "Could not read that file."
      )
    }
  }

  const onConfirm = async () => {
    if (stage.name !== "ready") {
      return
    }

    const { transactionId } = stage
    setStage({ name: "confirming" })

    try {
      await confirmVendorProductImport(transactionId)
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
      toast.success("Import started. It will finish in the background.")
      setOpen(false)
      reset()
    } catch (error) {
      setStage(stage)
      toast.error(
        error instanceof Error ? error.message : "Could not start the import."
      )
    }
  }

  return (
    <FocusModal
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          reset()
        }
      }}
    >
      <FocusModal.Trigger asChild>
        <Button size="small" variant="secondary">
          Import
        </Button>
      </FocusModal.Trigger>
      <FocusModal.Content>
        <FocusModal.Header>
          <Heading level="h2">Import products</Heading>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center p-6">
          <div className="flex w-full max-w-lg flex-col gap-y-4">
            {stage.name === "ready" ? (
              <div className="bg-ui-bg-subtle flex flex-col gap-y-2 rounded-lg p-4">
                <Text size="small" weight="plus">
                  {stage.filename}
                </Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {stage.toCreate} product{stage.toCreate === 1 ? "" : "s"} will
                  be created, {stage.toUpdate} updated.
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Imported products are added to the store but are not yet
                  assigned to your storefront listing - ask an administrator to
                  assign them after the import finishes.
                </Text>
              </div>
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      onFile(file)
                    }
                    // Cleared so selecting the same file twice still fires a
                    // change event.
                    event.target.value = ""
                  }}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={stage.name === "uploading"}
                  className="border-ui-border-strong text-ui-fg-subtle hover:bg-ui-bg-base-hover flex h-40 w-full flex-col items-center justify-center gap-y-2 rounded-lg border border-dashed"
                >
                  <Text size="small" weight="plus">
                    {stage.name === "uploading"
                      ? "Reading file..."
                      : "Choose a CSV file"}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Nothing is written until you confirm.
                  </Text>
                </button>
              </>
            )}
          </div>
        </FocusModal.Body>
        <FocusModal.Footer>
          <div className="flex items-center gap-x-2">
            <Button
              size="small"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="small"
              onClick={onConfirm}
              disabled={stage.name !== "ready"}
              isLoading={stage.name === "confirming"}
            >
              Import
            </Button>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}
