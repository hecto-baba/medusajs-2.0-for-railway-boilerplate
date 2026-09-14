import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { sdk } from "../lib/sdk"
import {
  TransactionType,
  TransactionTypeStatus,
} from "../types/transaction-type"

type TransactionTypeFormModalProps = {
  /** Omitted when creating. */
  transactionType?: TransactionType
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSaved: () => void
  trigger?: React.ReactNode
}

/**
 * One modal for both create and edit - the fields are identical, and the only
 * difference is whether a draft/activate choice is offered, which only makes
 * sense before a type has a lifecycle.
 */
export const TransactionTypeFormModal = ({
  transactionType,
  open: controlledOpen,
  onOpenChange,
  onSaved,
  trigger,
}: TransactionTypeFormModalProps) => {
  const isEdit = !!transactionType

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [iconUrl, setIconUrl] = useState("")
  const [uploading, setUploading] = useState(false)

  // Re-seed whenever the modal opens so a cancelled edit does not leave stale
  // values behind for the next one.
  useEffect(() => {
    if (!open) return

    setName(transactionType?.name ?? "")
    setCode(transactionType?.code ?? "")
    setDescription(transactionType?.description ?? "")
    setIconUrl(transactionType?.icon_url ?? "")
  }, [open, transactionType])

  const validationError = (() => {
    if (!name.trim()) return "A name is required"
    if (!code.trim()) return "A code is required"
    if (!/^[A-Za-z0-9_-]+$/.test(code.trim()))
      return "A code may only contain letters, numbers, underscores and hyphens"
    return null
  })()

  const save = useMutation({
    mutationFn: async (status?: TransactionTypeStatus) => {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || (isEdit ? null : undefined),
        icon_url: iconUrl.trim() || (isEdit ? null : undefined),
      }

      // Code is immutable in spirit but editable in practice; only send it
      // when it actually changed, so an unchanged edit cannot trip the
      // uniqueness check against itself.
      if (!isEdit || code.trim().toUpperCase() !== transactionType?.code) {
        body.code = code.trim().toUpperCase()
      }

      if (!isEdit && status) {
        body.status = status
      }

      return sdk.client.fetch(
        isEdit
          ? `/admin/transaction-types/${transactionType!.id}`
          : "/admin/transaction-types",
        { method: "POST", body }
      )
    },
    onSuccess: () => {
      toast.success(
        isEdit
          ? `"${name.trim()}" updated`
          : `"${name.trim()}" created`
      )
      setOpen(false)
      onSaved()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not save the transaction type")
    },
  })

  const uploadIcon = async (file: File) => {
    setUploading(true)

    try {
      const form = new FormData()
      form.append("files", file)

      const result: any = await sdk.client.fetch("/admin/uploads", {
        method: "POST",
        body: form,
      })

      const url = result?.files?.[0]?.url ?? result?.uploads?.[0]?.url

      if (!url) {
        throw new Error("The upload did not return a URL")
      }

      setIconUrl(url)
      toast.success("Icon uploaded")
    } catch (error: any) {
      toast.error(error?.message || "Could not upload the icon")
    } finally {
      setUploading(false)
    }
  }

  return (
    <FocusModal open={open} onOpenChange={setOpen}>
      {trigger && <FocusModal.Trigger asChild>{trigger}</FocusModal.Trigger>}

      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex w-full items-center justify-end gap-2">
            {isEdit ? (
              <Button
                size="small"
                onClick={() => save.mutate(undefined)}
                isLoading={save.isPending}
                disabled={!!validationError}
              >
                Save changes
              </Button>
            ) : (
              <>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => save.mutate(TransactionTypeStatus.DRAFT)}
                  isLoading={save.isPending}
                  disabled={!!validationError}
                >
                  Save as draft
                </Button>
                <Button
                  size="small"
                  onClick={() => save.mutate(TransactionTypeStatus.ACTIVE)}
                  isLoading={save.isPending}
                  disabled={!!validationError}
                >
                  Save and activate
                </Button>
              </>
            )}
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-10">
          <div className="flex w-full max-w-2xl flex-col gap-6 px-6">
            <div>
              <Heading level="h2">
                {isEdit ? "Edit transaction type" : "New transaction type"}
              </Heading>
              <Text size="small" className="text-ui-fg-subtle">
                {isEdit
                  ? "Update the configuration. Status and ordering are changed elsewhere."
                  : "A kind of transaction the marketplace supports. Save it as a draft to review it before anything can use it."}
              </Text>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label size="small" weight="plus">
                  Name
                </Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Purchase"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label size="small" weight="plus">
                  Code
                </Label>
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="PURCHASE"
                />
                <Text size="xsmall" className="text-ui-fg-muted">
                  Stored uppercase. Used to reference this type from other
                  systems and from CSV imports.
                </Text>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label size="small" weight="plus">
                Description
                <span className="text-ui-fg-muted"> (optional)</span>
              </Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Standard sale transaction"
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label size="small" weight="plus">
                Icon
                <span className="text-ui-fg-muted"> (optional)</span>
              </Label>

              <div className="flex items-center gap-3">
                {iconUrl ? (
                  <img
                    src={iconUrl}
                    alt=""
                    className="size-10 rounded-md border border-ui-border-base object-cover"
                  />
                ) : (
                  <div className="size-10 rounded-md border border-dashed border-ui-border-base" />
                )}

                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) uploadIcon(file)
                  }}
                  className="text-ui-fg-subtle text-sm"
                />

                {iconUrl && (
                  <Button
                    size="small"
                    variant="transparent"
                    type="button"
                    onClick={() => setIconUrl("")}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            {validationError && (
              <Text size="small" className="text-ui-fg-error">
                {validationError}
              </Text>
            )}
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

export default TransactionTypeFormModal
