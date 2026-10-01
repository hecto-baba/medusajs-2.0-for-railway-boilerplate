import { useState } from "react"
import { Button, Drawer, Input, Label, RadioGroup, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../../lib/sdk"

type AddEmployeeFormProps = {
  companyId: string
  currencyCode?: string
  onSuccess: () => void
  onCancel: () => void
}

export const AddEmployeeForm = ({
  companyId,
  currencyCode = "EUR",
  onSuccess,
  onCancel,
}: AddEmployeeFormProps) => {
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "member">("member")
  const [spendingLimit, setSpendingLimit] = useState<string>("1000")

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (payload: any) =>
      sdk.client.fetch(`/admin/companies/${companyId}/employees`, {
        method: "POST",
        body: payload,
      }),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error("Validation Error", { description: "Email is required" })
      return
    }

    try {
      await mutateAsync({
        first_name: firstName,
        last_name: lastName,
        email,
        password: password || undefined,
        is_admin: role === "admin",
        spending_limit: role === "admin" ? null : Number(spendingLimit) || null,
      })

      toast.success("Success", {
        description: `${role === "admin" ? "Company Manager" : "Employee"} added successfully!`,
      })
      queryClient.invalidateQueries({ queryKey: ["company", companyId] })
      onSuccess()
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to add member",
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
      <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-4 overflow-y-auto p-6">
        <div className="flex flex-col space-y-2">
          <Label size="small" weight="plus">Role Type *</Label>
          <RadioGroup
            value={role}
            onValueChange={(val: any) => setRole(val)}
            className="flex gap-x-4"
          >
            <div
              className={`flex flex-1 items-center gap-x-2.5 border rounded-lg p-3.5 cursor-pointer transition-colors ${
                role === "admin"
                  ? "border-purple-500 bg-purple-50/60 ring-1 ring-purple-500"
                  : "border-ui-border-base hover:bg-ui-bg-subtle"
              }`}
              onClick={() => setRole("admin")}
            >
              <RadioGroup.Item value="admin" id="role-admin" />
              <Label htmlFor="role-admin" className="cursor-pointer flex-1">
                <div className="font-semibold text-sm text-purple-950">🛡️ Company Manager</div>
                <p className="text-xs text-ui-fg-subtle mt-0.5">Full admin, unlimited budget, approves orders</p>
              </Label>
            </div>
            <div
              className={`flex flex-1 items-center gap-x-2.5 border rounded-lg p-3.5 cursor-pointer transition-colors ${
                role === "member"
                  ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                  : "border-ui-border-base hover:bg-ui-bg-subtle"
              }`}
              onClick={() => setRole("member")}
            >
              <RadioGroup.Item value="member" id="role-member" />
              <Label htmlFor="role-member" className="cursor-pointer flex-1">
                <div className="font-semibold text-sm text-blue-950">👤 Company Employee</div>
                <p className="text-xs text-ui-fg-subtle mt-0.5">Purchasing buyer with assigned spending limit</p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col space-y-2">
            <Label size="small" weight="plus">First Name</Label>
            <Input
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="flex flex-col space-y-2">
            <Label size="small" weight="plus">Last Name</Label>
            <Input
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <Label size="small" weight="plus">Email Address *</Label>
          <Input
            type="email"
            placeholder="member@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col space-y-2">
          <Label size="small" weight="plus">Initial Login Password</Label>
          <Input
            type="password"
            placeholder="Set password for Storefront login"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-ui-fg-subtle">
            Setting a password here enables immediate storefront login for this member without "Account Not Found" errors.
          </p>
        </div>

        {role === "member" && (
          <div className="flex flex-col space-y-2">
            <Label size="small" weight="plus">
              Spending Limit ({currencyCode.toUpperCase()})
            </Label>
            <Input
              type="number"
              placeholder="1000"
              value={spendingLimit}
              onChange={(e) => setSpendingLimit(e.target.value)}
            />
            <p className="text-xs text-ui-fg-subtle">
              Carts exceeding this amount will require manager approval before checkout.
            </p>
          </div>
        )}
      </Drawer.Body>

      <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-4">
        <Button variant="secondary" size="small" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button size="small" type="submit" isLoading={isPending}>
          Add {role === "admin" ? "Manager" : "Employee"}
        </Button>
      </Drawer.Footer>
    </form>
  )
}
