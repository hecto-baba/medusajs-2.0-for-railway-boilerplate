"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Badge,
  Container,
  Heading,
  Table,
  Text,
} from "@medusajs/ui"
import {
  ArrowLeft,
  BuildingStorefront,
  Envelope,
  MapPin,
  Phone,
  User,
} from "@medusajs/icons"
import Link from "next/link"
import { getVendorCompany } from "@lib/data/vendor-client"

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-company", id],
    queryFn: () => getVendorCompany(id),
    enabled: !!id,
  })

  const company = data?.company

  if (isLoading || !company) {
    return <div className="p-8 text-center text-ui-fg-subtle">Loading company details...</div>
  }

  const employees = company.employees || []

  return (
    <div className="flex flex-col gap-y-6 max-w-5xl mx-auto p-4 md:p-8">
      <div>
        <Link
          href="/b2b/companies"
          className="text-xs font-semibold text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Companies
        </Link>
        <div className="flex items-center justify-between mt-2">
          <Heading level="h1" className="text-2xl font-bold flex items-center gap-2">
            <BuildingStorefront className="w-6 h-6 text-ui-fg-base" />
            {company.name}
          </Heading>
          <Badge color="blue" size="small">
            {company.currency_code?.toUpperCase()} Corporate Account
          </Badge>
        </div>
      </div>

      {/* Corporate Overview */}
      <Container className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <Envelope className="w-5 h-5 text-ui-fg-subtle mt-0.5 shrink-0" />
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
                Corporate Email
              </Text>
              <Text className="text-sm font-medium text-ui-fg-base mt-0.5 font-mono">
                {company.email}
              </Text>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-ui-fg-subtle mt-0.5 shrink-0" />
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
                Phone Number
              </Text>
              <Text className="text-sm font-medium text-ui-fg-base mt-0.5">
                {company.phone || "Not provided"}
              </Text>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-ui-fg-subtle mt-0.5 shrink-0" />
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
                Billing Location
              </Text>
              <Text className="text-sm font-medium text-ui-fg-base mt-0.5">
                {company.address || ""} {company.city ? `${company.city}, ` : ""}{company.country_code?.toUpperCase() || ""}
              </Text>
            </div>
          </div>
        </div>
      </Container>

      {/* Employees Table */}
      <Container className="p-0 overflow-hidden divide-y divide-ui-border-base">
        <div className="p-4 flex items-center justify-between">
          <div>
            <Heading level="h3" className="text-base font-semibold">
              Authorized Employees & Buyers ({employees.length})
            </Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Corporate members eligible to order wholesale on behalf of {company.name}.
            </Text>
          </div>
        </div>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Employee Name</Table.HeaderCell>
              <Table.HeaderCell>Customer ID</Table.HeaderCell>
              <Table.HeaderCell>Role / Status</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {employees.length === 0 ? (
              <Table.Row>
                <td colSpan={3} className="text-center py-8 text-ui-fg-subtle">
                  No individual employee accounts linked to this corporate account yet.
                </td>
              </Table.Row>
            ) : (
              employees.map((emp: any) => (
                <Table.Row key={emp.id}>
                  <Table.Cell className="font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-ui-fg-subtle" />
                    <span>{emp.customer?.first_name || "Employee"} {emp.customer?.last_name || ""}</span>
                  </Table.Cell>
                  <Table.Cell className="text-xs font-mono text-ui-fg-subtle">
                    {emp.customer_id || emp.id}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="green" size="xsmall">Authorized Buyer</Badge>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Container>
    </div>
  )
}
