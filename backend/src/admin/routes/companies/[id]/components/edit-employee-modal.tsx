import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Button, Drawer, Heading, Label, Switch, Text, toast } from "@medusajs/ui"
import { InformationCircleSolid } from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../../lib/sdk"

type EditEmployeeModalProps = {
  companyId: string
  company?: any
  employee: any
  currencyCode?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const EditEmployeeModal = ({
  companyId,
  company,
  employee,
  currencyCode = "EUR",
  open,
  onOpenChange,
}: EditEmployeeModalProps) => {
  const queryClient = useQueryClient()
  const [isAdmin, setIsAdmin] = useState(Boolean(employee?.is_admin))
  const [spendingLimit, setSpendingLimit] = useState(
    employee?.spending_limit ? employee.spending_limit.toString() : ""
  )

  useEffect(() => {
    if (employee) {
      setIsAdmin(Boolean(employee.is_admin))
      setSpendingLimit(
        employee.spending_limit !== null && employee.spending_limit !== undefined
          ? employee.spending_limit.toString()
          : ""
      )
    }
  }, [employee])

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (data: any) =>
      sdk.client.fetch(`/admin/companies/${companyId}/employees/${employee?.id}`, {
        method: "POST",
        body: data,
      }),
  })

  const handleSave = async () => {
    try {
      await mutateAsync({
        is_admin: isAdmin,
        spending_limit: isAdmin ? null : (spendingLimit ? Number(spendingLimit) : null),
      })
      toast.success("Success", { description: "Employee updated successfully" })
      queryClient.invalidateQueries({ queryKey: ["company", companyId] })
      onOpenChange(false)
    } catch (err: any) {
      toast.error("Error", { description: err.message || "Failed to update employee" })
    }
  }

  const customer = employee?.customer || {}
  const fullName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Employee"
  const companyName = company?.name || employee?.company?.name || "Apex Global Logistics LLC"

  const symbolMap: Record<string, string> = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    INR: "₹",
  }
  const currCodeUpper = (currencyCode || "EUR").toUpperCase()
  const currencySymbol = symbolMap[currCodeUpper] || currCodeUpper

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="flex flex-col h-full bg-ui-bg-base">
        <Drawer.Header className="flex items-center justify-between border-b px-6 py-4">
          <Drawer.Title className="text-base font-semibold text-ui-fg-base">
            Edit Employee
          </Drawer.Title>
        </Drawer.Header>

        <Drawer.Body className="flex-1 overflow-y-auto p-6 flex flex-col gap-y-6">
          {/* Details Section matching Screenshot */}
          <div className="flex flex-col gap-y-3">
            <div className="flex items-center justify-between">
              <Heading level="h2" className="text-sm font-semibold text-ui-fg-base">
                Details
              </Heading>
              {customer?.id && (
                <Link
                  to={`/customers/${customer.id}`}
                  className="text-xs font-medium text-ui-fg-interactive hover:underline"
                >
                  Edit Customer Details
                </Link>
              )}
            </div>

            <div className="divide-y divide-ui-border-base border-t border-b border-ui-border-base text-sm">
              <div className="grid grid-cols-3 py-3">
                <Text className="text-ui-fg-subtle text-sm">Name</Text>
                <Text className="col-span-2 text-ui-fg-base text-sm font-medium">
                  {fullName}
                </Text>
              </div>
              <div className="grid grid-cols-3 py-3">
                <Text className="text-ui-fg-subtle text-sm">Email</Text>
                <Text className="col-span-2 text-ui-fg-base text-sm font-medium">
                  {customer.email || "—"}
                </Text>
              </div>
              <div className="grid grid-cols-3 py-3">
                <Text className="text-ui-fg-subtle text-sm">Phone</Text>
                <Text className="col-span-2 text-ui-fg-base text-sm">
                  {customer.phone || "—"}
                </Text>
              </div>
              <div className="grid grid-cols-3 py-3">
                <Text className="text-ui-fg-subtle text-sm">Company</Text>
                <Text className="col-span-2 text-ui-fg-base text-sm">
                  {companyName}
                </Text>
              </div>
            </div>
          </div>

          {/* Permissions Section matching Screenshot */}
          <div className="flex flex-col gap-y-4">
            <Heading level="h2" className="text-sm font-semibold text-ui-fg-base">
              Permissions
            </Heading>

            {/* Spending Limit input with currency badges */}
            <div className="flex flex-col space-y-1.5">
              <Label size="small" weight="plus" className="text-ui-fg-subtle text-xs">
                Spending Limit
              </Label>
              <div className="flex items-center rounded-md border border-ui-border-base bg-ui-bg-field focus-within:ring-2 focus-within:ring-ui-border-interactive overflow-hidden">
                <span className="px-3 py-2 text-xs font-medium text-ui-fg-muted bg-ui-bg-subtle border-r border-ui-border-base select-none">
                  {currCodeUpper}
                </span>
                <input
                  type="number"
                  placeholder="e.g. 1000"
                  value={spendingLimit}
                  onChange={(e) => setSpendingLimit(e.target.value)}
                  disabled={isAdmin}
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-right outline-none text-ui-fg-base disabled:text-ui-fg-muted disabled:cursor-not-allowed"
                />
                <span className="px-3 py-2 text-xs font-medium text-ui-fg-muted bg-ui-bg-subtle border-l border-ui-border-base select-none">
                  {currencySymbol}
                </span>
              </div>
              {isAdmin && (
                <Text className="text-xs text-ui-fg-subtle italic">
                  Spending limit is disabled for Managers (Admin Access enabled).
                </Text>
              )}
            </div>

            {/* Admin Access Switch */}
            <div className="flex flex-col space-y-1.5 pt-1">
              <Label size="small" weight="plus" className="text-ui-fg-subtle text-xs">
                Admin Access
              </Label>
              <div className="flex items-center gap-x-2.5">
                <Switch
                  checked={isAdmin}
                  onCheckedChange={setIsAdmin}
                  id="admin-access-switch"
                />
                <Label
                  htmlFor="admin-access-switch"
                  className="flex items-center gap-x-1.5 text-sm font-medium cursor-pointer"
                >
                  <span>Is Admin</span>
                  <InformationCircleSolid className="text-ui-fg-muted h-4 w-4" />
                </Label>
              </div>
              <Text className="text-xs text-ui-fg-subtle">
                Enable to grant admin access
              </Text>
            </div>
          </div>
        </Drawer.Body>

        <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t px-6 py-4">
          <Drawer.Close asChild>
            <Button
              variant="secondary"
              size="small"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </Drawer.Close>
          <Button size="small" onClick={handleSave} isLoading={isPending}>
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
