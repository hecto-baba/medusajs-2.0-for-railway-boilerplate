import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminCustomer } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { BuildingStorefront, ArrowRight } from "@medusajs/icons"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { sdk } from "../lib/sdk"

const CustomerCompanyWidget = ({
  data: customer,
}: DetailWidgetProps<AdminCustomer>) => {
  const { data: companiesData, isLoading } = useQuery<{ companies: any[] }>({
    queryKey: ["companies-for-customer", customer.id],
    queryFn: () => sdk.client.fetch("/admin/companies"),
  })

  const companies = companiesData?.companies || []
  const matchedCompany = companies.find((comp: any) =>
    comp.employees?.some((emp: any) => emp.customer?.id === customer.id || emp.customer_id === customer.id)
  )
  const matchedEmployee = matchedCompany?.employees?.find(
    (emp: any) => emp.customer?.id === customer.id || emp.customer_id === customer.id
  )

  if (isLoading || !matchedCompany) {
    return null
  }

  const isManager = Boolean(matchedEmployee?.is_admin)
  const currency = (matchedCompany.currency_code || "EUR").toUpperCase()
  const spendingLimit = matchedEmployee?.spending_limit
    ? `${currency} ${Number(matchedEmployee.spending_limit).toLocaleString()}`
    : "Unlimited"

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-2.5">
          <BuildingStorefront className="text-ui-fg-muted" />
          <Heading level="h2" className="text-sm font-semibold">
            B2B Company Membership
          </Heading>
        </div>
        <Button size="small" variant="secondary" asChild>
          <Link to={`/companies/${matchedCompany.id}`} className="gap-x-1">
            <span>View Company</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ui-border-base p-6 gap-4 text-sm">
        <div>
          <Text className="text-ui-fg-subtle text-xs mb-1">Company</Text>
          <Text className="font-semibold text-ui-fg-base">{matchedCompany.name}</Text>
          <Text className="text-ui-fg-muted text-xs">{matchedCompany.email || "—"}</Text>
        </div>

        <div className="pt-3 md:pt-0 md:pl-4">
          <Text className="text-ui-fg-subtle text-xs mb-1">Assigned Role</Text>
          {isManager ? (
            <Badge color="purple" size="small" className="font-semibold gap-x-1">
              🛡️ Company Manager
            </Badge>
          ) : (
            <Badge color="blue" size="small" className="font-semibold gap-x-1">
              👤 Employee (Buyer)
            </Badge>
          )}
        </div>

        <div className="pt-3 md:pt-0 md:pl-4">
          <Text className="text-ui-fg-subtle text-xs mb-1">Order Spending Limit</Text>
          <Text className="font-medium text-ui-fg-base">{spendingLimit}</Text>
          <Text className="text-ui-fg-muted text-xs">
            {isManager ? "Unlimited authority" : "Requires manager approval above limit"}
          </Text>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "customer.details.after",
})

export default CustomerCompanyWidget
