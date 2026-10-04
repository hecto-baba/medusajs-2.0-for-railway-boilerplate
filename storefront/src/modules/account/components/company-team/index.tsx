"use client"

import { useState } from "react"
import { Button, Heading, Input, Label, Switch, Table, Text, toast } from "@medusajs/ui"
import { Plus, User, CheckCircle, XCircle } from "@medusajs/icons"
import Chip from "@modules/common/components/chip"
import { addCompanyEmployee, CompanyEmployee } from "@lib/data/company"

type CompanyTeamProps = {
  initialEmployees: CompanyEmployee[]
  isManager: boolean
  currencyCode?: string
}

export const CompanyTeam = ({
  initialEmployees,
  isManager,
  currencyCode = "EUR",
}: CompanyTeamProps) => {
  const [employees, setEmployees] = useState<CompanyEmployee[]>(initialEmployees)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [spendingLimit, setSpendingLimit] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [password, setPassword] = useState("Password123!")

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error("Validation Error", { description: "Email is required." })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await addCompanyEmployee({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || undefined,
        spending_limit: spendingLimit ? Number(spendingLimit) : null,
        is_admin: isAdmin,
        password: password || "Password123!",
      })

      if (res.success && res.employee) {
        toast.success("Employee Added", {
          description: `${firstName || email} has been added to your company team.`,
        })
        setEmployees((prev) => [...prev, res.employee])
        setShowAddModal(false)
        // Reset form
        setFirstName("")
        setLastName("")
        setEmail("")
        setPhone("")
        setSpendingLimit("")
        setIsAdmin(false)
      } else {
        toast.error("Failed to add employee", {
          description: res.error || "An error occurred.",
        })
      }
    } catch (err: any) {
      toast.error("Error", {
        description: err.message || "Failed to add team member.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const currency = currencyCode.toUpperCase()

  return (
    <div className="rounded-large bg-card p-5 shadow-lift flex flex-col gap-y-6">
      {/* Header */}
      <div className="flex flex-col small:flex-row small:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <Heading level="h3" className="font-display text-lg font-extrabold tracking-tight">
            Company Team & Permissions
          </Heading>
          <Text className="text-xs text-muted mt-1">
            Colleagues in your organization authorized to purchase or manage business orders.
          </Text>
        </div>

        {isManager && (
          <Button
            size="small"
            onClick={() => setShowAddModal(true)}
            className="gap-x-1.5 flex-shrink-0 !rounded-large !border-0 !bg-brand !font-extrabold !text-brand-ink !shadow-none hover:!opacity-90"
          >
            <Plus className="w-4 h-4" />
            <span>Add Team Member</span>
          </Button>
        )}
      </div>

      {/* Team Table */}
      <div className="overflow-x-auto"><Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Colleague</Table.HeaderCell>
            <Table.HeaderCell>Role</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Spending Limit</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {employees.length === 0 ? (
            <Table.Row>
              <Table.Cell {...({ colSpan: 3 } as any)} className="text-center py-6 text-muted">
                No colleagues registered yet.
              </Table.Cell>
            </Table.Row>
          ) : (
            employees.map((emp) => {
              const customer: any = emp.customer || {}
              const name =
                [customer.first_name, customer.last_name]
                  .filter(Boolean)
                  .join(" ") || "Employee"
              const email = customer.email || "—"
              const limit = emp.spending_limit
                ? `${Number(emp.spending_limit).toLocaleString()} ${currency}`
                : emp.is_admin
                ? "Unlimited"
                : "No Limit Set"

              return (
                <Table.Row key={emp.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-x-3">
                      <div className="w-8 h-8 rounded-circle bg-brand-soft flex items-center justify-center text-xs font-bold text-muted">
                        {customer.first_name ? customer.first_name[0] : "E"}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-ink">{name}</div>
                        <div className="text-xs text-muted font-mono">{email}</div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {emp.is_admin ? (
                      <Chip tone="warning">Manager</Chip>
                    ) : (
                      <Chip tone="success">Buyer</Chip>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-right font-mono text-sm font-bold">
                    {limit}
                  </Table.Cell>
                </Table.Row>
              )
            })
          )}
        </Table.Body>
      </Table></div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4">
          <div className="bg-card rounded-large shadow-pop max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <Heading level="h3" className="font-display text-base font-extrabold tracking-tight">
                  Add Team Member
                </Heading>
                <Text className="text-xs text-muted">
                  Invite an employee or manager to purchase for your company.
                </Text>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted hover:text-ink text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="flex flex-col gap-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">First Name</Label>
                  <Input
                    placeholder="e.g. Sarah"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Last Name</Label>
                  <Input
                    placeholder="e.g. Connor"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Email Address</Label>
                <Input
                  type="email"
                  placeholder="colleague@yourcompany.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Phone Number (optional)</Label>
                <Input
                  placeholder="+1 555 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Initial Password</Label>
                <Input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password123!"
                />
                <span className="text-[11px] text-muted">
                  The employee can use this password to sign into their storefront account.
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-[12px] border border-line bg-canvas">
                <div>
                  <Label className="text-sm font-bold">Company Manager (Admin)</Label>
                  <Text className="text-xs text-muted">
                    Allow this user to approve orders and manage team members.
                  </Text>
                </div>
                <Switch
                  checked={isAdmin}
                  onCheckedChange={(checked) => setIsAdmin(checked)}
                />
              </div>

              {!isAdmin && (
                <div className="space-y-1">
                  <Label className="text-xs">Per-Order Spending Limit ({currency})</Label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="e.g. 500"
                    value={spendingLimit}
                    onChange={(e) => setSpendingLimit(e.target.value)}
                  />
                  <span className="text-[11px] text-muted">
                    Orders exceeding this limit require manager approval at checkout.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-x-2 pt-4 border-t border-line">
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="small"
                  isLoading={isSubmitting}
                  className="!rounded-large !border-0 !bg-brand !font-extrabold !text-brand-ink !shadow-none hover:!opacity-90"
                >
                  Add Colleague
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
