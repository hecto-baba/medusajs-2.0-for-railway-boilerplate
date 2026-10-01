import { useState } from "react"
import { Button, FocusModal, Heading, Label, Select, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

type ManageCustomerGroupModalProps = {
  company: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ManageCustomerGroupModal = ({
  company,
  open,
  onOpenChange,
}: ManageCustomerGroupModalProps) => {
  const queryClient = useQueryClient()
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ["customer-groups"],
    queryFn: () => sdk.client.fetch<any>("/admin/customer-groups"),
    enabled: open,
  })

  const groups = groupsData?.customer_groups || []

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (groupId: string) =>
      sdk.client.fetch(`/admin/companies/${company?.id}/customer-group`, {
        method: "POST",
        body: { customer_group_id: groupId },
      }),
  })

  const handleSave = async () => {
    if (!selectedGroupId) {
      toast.error("Please select a customer group")
      return
    }

    try {
      await mutateAsync(selectedGroupId)
      toast.success("Success", { description: "Customer group linked successfully" })
      queryClient.invalidateQueries({ queryKey: ["companies"] })
      queryClient.invalidateQueries({ queryKey: ["company", company?.id] })
      onOpenChange(false)
    } catch (err: any) {
      toast.error("Error", { description: err.message || "Failed to update customer group" })
    }
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="max-w-md mx-auto my-auto rounded-lg border bg-ui-bg-base p-6 shadow-elevation-modal">
        <FocusModal.Header className="pb-4 border-b">
          <Heading level="h2">Manage Customer Group</Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Attach a customer group to <strong>{company?.name}</strong> to apply contract wholesale pricing.
          </Text>
        </FocusModal.Header>

        <FocusModal.Body className="py-6 flex flex-col gap-y-4">
          <div className="flex flex-col space-y-2">
            <Label size="small" weight="plus">Select Customer Group</Label>
            {isLoading ? (
              <Text className="text-ui-fg-subtle text-sm">Loading groups...</Text>
            ) : (
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <Select.Trigger>
                  <Select.Value placeholder="Select a wholesale customer group" />
                </Select.Trigger>
                <Select.Content>
                  {groups.map((group: any) => (
                    <Select.Item key={group.id} value={group.id}>
                      {group.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            )}
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
