"use client"

import {
  createVendorApiKey,
  type VendorApiKey,
} from "@lib/data/vendor-client"
import { Check, CheckCircleSolid, ExclamationCircleSolid, Key, SquareTwoStack } from "@medusajs/icons"
import {
  Badge,
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  RadioGroup,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type ApiKeyCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultType?: "publishable" | "secret"
  lockType?: boolean
}

export const ApiKeyCreateModal = ({
  open,
  onOpenChange,
  onSuccess,
  defaultType = "publishable",
  lockType = false,
}: ApiKeyCreateModalProps) => {
  const queryClient = useQueryClient()

  const [title, setTitle] = useState("")
  const [type, setType] = useState<"publishable" | "secret">(defaultType)
  const [createdKey, setCreatedKey] = useState<VendorApiKey | null>(null)
  const [copied, setCopied] = useState(false)

  const handleClose = () => {
    onOpenChange(false)
    setTitle("")
    setType(defaultType)
    setCreatedKey(null)
    setCopied(false)
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createVendorApiKey({
        title: title.trim(),
        type,
      }),
    onSuccess: (res) => {
      setCreatedKey(res.api_key)
      queryClient.invalidateQueries({ queryKey: ["vendor-api-keys"] })
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create API key")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Key title is required")
      return
    }
    createMutation.mutate()
  }

  const handleCopy = () => {
    if (createdKey?.token) {
      navigator.clipboard.writeText(createdKey.token)
      setCopied(true)
      toast.success("API key copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <FocusModal open={open} onOpenChange={handleClose}>
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">
                {createdKey ? "API Key Created" : "Create API Key"}
              </Heading>
            </FocusModal.Title>
            <FocusModal.Description className="text-ui-fg-subtle text-sm">
              {createdKey
                ? "Copy your new API token now. Secret tokens cannot be shown again."
                : "Create publishable or secret API keys for custom storefront integrations and scripts."}
            </FocusModal.Description>
          </div>
          <div className="flex items-center gap-x-2">
            {createdKey ? (
              <Button type="button" onClick={handleClose}>
                Done
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  isLoading={createMutation.isPending}
                  onClick={handleSubmit}
                >
                  Create Key
                </Button>
              </>
            )}
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 flex-col gap-y-6 p-6 max-w-lg mx-auto w-full">
          {createdKey ? (
            <div className="flex flex-col gap-y-6 py-4">
              <div className="flex items-center gap-x-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
                <CheckCircleSolid className="h-5 w-5 text-ui-fg-interactive shrink-0" />
                <div>
                  <Text size="small" weight="plus">
                    {createdKey.title}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Type: {createdKey.type === "publishable" ? "Publishable Key" : "Secret Key"}
                  </Text>
                </div>
              </div>

              {createdKey.type === "secret" && (
                <div className="flex items-start gap-x-3 rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg p-4 text-ui-tag-orange-text">
                  <ExclamationCircleSolid className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-y-1">
                    <Text size="small" weight="plus">
                      Save your secret key
                    </Text>
                    <Text size="small">
                      Please copy your secret key and store it somewhere safe. For security reasons,
                      you won&apos;t be able to view it again.
                    </Text>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  API Key Token
                </Label>
                <div className="flex items-center gap-x-2">
                  <Input
                    readOnly
                    value={createdKey.token}
                    className="font-mono text-xs bg-ui-bg-subtle select-all"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? <Check /> : <SquareTwoStack />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-y-6">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Key Title <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  placeholder="e.g. Next.js Storefront, Mobile App, POS Terminal"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {!lockType ? (
                <div className="flex flex-col gap-y-3">
                  <Label size="small" weight="plus">
                    Key Type
                  </Label>
                  <RadioGroup
                    value={type}
                    onValueChange={(val) => setType(val as "publishable" | "secret")}
                    className="flex flex-col gap-y-3"
                  >
                    <label
                      htmlFor="type-publishable"
                      className="flex items-start gap-x-3 rounded-lg border p-4 cursor-pointer hover:bg-ui-bg-subtle transition-colors"
                    >
                      <RadioGroup.Item
                        value="publishable"
                        id="type-publishable"
                        className="mt-0.5"
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-x-2">
                          <Text size="small" weight="plus">
                            Publishable Key
                          </Text>
                          <Badge size="small" color="blue">Client-side</Badge>
                        </div>
                        <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                          Used in public client-side applications and storefronts with scoped permissions.
                        </Text>
                      </div>
                    </label>

                    <label
                      htmlFor="type-secret"
                      className="flex items-start gap-x-3 rounded-lg border p-4 cursor-pointer hover:bg-ui-bg-subtle transition-colors"
                    >
                      <RadioGroup.Item
                        value="secret"
                        id="type-secret"
                        className="mt-0.5"
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-x-2">
                          <Text size="small" weight="plus">
                            Secret Key
                          </Text>
                          <Badge size="small" color="purple">Backend / CLI</Badge>
                        </div>
                        <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                          Used for secure server-to-server operations and automated scripts with full vendor privileges.
                        </Text>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
              ) : (
                <div className="flex items-center gap-x-2 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
                  <Badge size="small" color={type === "secret" ? "purple" : "blue"}>
                    {type === "secret" ? "Secret Key" : "Publishable Key"}
                  </Badge>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {type === "secret"
                      ? "Creating a secret API key for backend integrations."
                      : "Creating a publishable API key for client-side storefronts."}
                  </Text>
                </div>
              )}
            </form>
          )}
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
