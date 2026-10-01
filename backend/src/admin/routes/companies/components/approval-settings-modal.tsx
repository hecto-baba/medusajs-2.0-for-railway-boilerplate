import { useState } from "react"
import { Button, FocusModal, Heading, Label, Select, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

type ApprovalSettingsModalProps = {
  company: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ApprovalSettingsModal = ({
  company,
  open,
  onOpenChange,
}: ApprovalSettingsModalProps) => {
  const queryClient = useQueryClient()
  const [ruleType, setRuleType] = useState<string>("spending_limit")

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (data: any) =>
      sdk.client.fetch(`/admin/companies/${company?.id}`, {
        method: "POST",
        body: data,
      }),
  })

  const handleSave = async () => {
    try {
      await mutateAsync({
        approval_settings: {
          requires_approval: ruleType !== "none",
          type: ruleType,
        },
      })
      toast.success("Success", { description: "Approval settings saved" })
      queryClient.invalidateQueries({ queryKey: ["companies"] })
      queryClient.invalidateQueries({ queryKey: ["company", company?.id] })
      onOpenChange(false)
    } catch (err: any) {
      toast.error("Error", { description: err.message || "Failed to save approval settings" })
    }
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="max-w-md mx-auto my-auto rounded-lg border bg-ui-bg-base p-6 shadow-elevation-modal">
        <FocusModal.Header className="pb-4 border-b">
          <Heading level="h2">Approval Settings</Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Configure order approval policy for <strong>{company?.name}</strong>.
          </Text>
        </FocusModal.Header>

        <FocusModal.Body className="py-6 flex flex-col gap-y-4">
          <div className="flex flex-col space-y-2">
            <Label size="small" weight="plus">Approval Policy</Label>
            <Select value={ruleType} onValueChange={setRuleType}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="spending_limit">
                  Enforce Employee Spending Limits (Over-budget orders require Manager Approval)
                </Select.Item>
                <Select.Item value="all_orders">
                  Require Manager Approval on All Employee Orders
                </Select.Item>
                <Select.Item value="none">
                  No Approval Required (Free checkout)
                </Select.Item>
              </Select.Content>
            </Select>
          </div>
        </FocusModal.Body>

        <div className="flex items-center justify-end gap-x-2 pt-4 border-t">
          <Button variant="secondary" size="small" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="small" onClick={handleSave} isLoading={isPending}>
            Save
          </Button>
        </div>
      </FocusModal.Content>
    </FocusModal>
  )
}
