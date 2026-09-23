import {
  Button,
  FocusModal,
  Heading,
  IconBadge,
  Text,
  toast,
} from "@medusajs/ui"
import { CheckCircle, ExclamationCircle } from "@medusajs/icons"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../lib/sdk"
import {
  ImportSummaryResponse,
  IMPORT_TEMPLATE_COLUMNS,
} from "../types/transaction-type"

type ImportModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

/**
 * Two-phase import, matching the server: uploading only parses and validates,
 * and nothing is written until the admin confirms what the preview shows.
 */
export const TransactionTypeImportModal = ({
  open,
  onOpenChange,
  onImported,
}: ImportModalProps) => {
  const [summary, setSummary] = useState<ImportSummaryResponse | null>(null)

  const reset = () => setSummary(null)

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)

      return sdk.client.fetch<ImportSummaryResponse>(
        "/admin/transaction-types/import",
        { method: "POST", body: form }
      )
    },
    onSuccess: (data) => setSummary(data),
    onError: (error: any) => {
      toast.error(error?.message || "Could not read the file")
    },
  })

  const confirm = useMutation({
    mutationFn: () =>
      sdk.client.fetch(
        `/admin/transaction-types/import/${summary!.transaction_id}/confirm`,
        { method: "POST" }
      ),
    onSuccess: () => {
      toast.success("Import started")
      onOpenChange(false)
      reset()
      // The workflow resumes asynchronously, so the list is refreshed a beat
      // later rather than immediately.
      setTimeout(onImported, 1500)
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not complete the import")
    },
  })

  const downloadTemplate = () => {
    const csv = `${IMPORT_TEMPLATE_COLUMNS.join(",")}\nPurchase,PURCHASE,Standard sale,,draft\n`
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = "transaction-types-template.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Revoked on the next tick, not immediately: the download starts
    // asynchronously, and revoking synchronously races it - Safari in
    // particular ends up with an empty file.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const errors = summary?.summary.errors ?? []
  const hasErrors = errors.length > 0

  return (
    <FocusModal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex w-full items-center justify-end gap-2">
            <Button size="small" variant="secondary" onClick={downloadTemplate}>
              Download template
            </Button>

            {summary && (
              <Button
                size="small"
                onClick={() => confirm.mutate()}
                isLoading={confirm.isPending}
                disabled={hasErrors}
              >
                Confirm import
              </Button>
            )}
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-10">
          <div className="flex w-full max-w-2xl flex-col gap-6 px-6">
            <div>
              <Heading level="h2">
                {summary ? "Review import" : "Import transaction types"}
              </Heading>
              <Text size="small" className="text-ui-fg-subtle">
                {summary
                  ? "Nothing has been written yet. Check the summary below, then confirm."
                  : "Upload a CSV using the template columns. Rows are matched on code - an existing code updates that type, a new one creates it."}
              </Text>
            </div>

            {!summary ? (
              <div className="flex flex-col gap-3">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={upload.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) upload.mutate(file)
                  }}
                  className="text-ui-fg-subtle text-sm"
                />

                {upload.isPending && (
                  <Text size="small" className="text-ui-fg-subtle">
                    Reading file...
                  </Text>
                )}

                <Text size="xsmall" className="text-ui-fg-muted">
                  Columns: {IMPORT_TEMPLATE_COLUMNS.join(", ")}. Only draft and
                  active may be set by import.
                </Text>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Text size="small" className="text-ui-fg-subtle">
                  {summary.summary.filename}
                </Text>

                <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-4">
                  <div className="flex items-center gap-2">
                    <IconBadge color={hasErrors ? "grey" : "green"} size="base">
                      <CheckCircle />
                    </IconBadge>
                    <Text size="small">
                      {summary.summary.to_create} to create
                    </Text>
                  </div>

                  <div className="flex items-center gap-2">
                    <IconBadge color={hasErrors ? "grey" : "green"} size="base">
                      <CheckCircle />
                    </IconBadge>
                    <Text size="small">
                      {summary.summary.to_update} to update
                    </Text>
                  </div>

                  {hasErrors && (
                    <div className="flex items-start gap-2">
                      <IconBadge color="red" size="base">
                        <ExclamationCircle />
                      </IconBadge>
                      <div className="flex flex-col gap-1">
                        <Text size="small" className="text-ui-fg-error">
                          {errors.length} error
                          {errors.length > 1 ? "s" : ""}
                        </Text>
                        {errors.map((error) => (
                          <Text
                            key={`${error.row}-${error.message}`}
                            size="xsmall"
                            className="text-ui-fg-subtle"
                          >
                            Row {error.row}: {error.message}
                          </Text>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {hasErrors && (
                  <Text size="small" className="text-ui-fg-error">
                    Fix the rows above and upload again - a file with errors
                    cannot be imported.
                  </Text>
                )}

                <Button
                  size="small"
                  variant="secondary"
                  onClick={reset}
                  className="self-start"
                >
                  Choose a different file
                </Button>
              </div>
            )}
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

export default TransactionTypeImportModal
