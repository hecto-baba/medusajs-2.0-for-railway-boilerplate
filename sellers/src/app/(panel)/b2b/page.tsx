"use client"

import { Container, Heading, Text, Button } from "@medusajs/ui"
import { BuildingStorefront, DocumentText, CheckCircle } from "@medusajs/icons"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  listVendorCompanies,
  listVendorQuotes,
  listVendorApprovals,
} from "@lib/data/vendor-client"

export default function B2BOverviewPage() {
  const { data: companiesData } = useQuery({
    queryKey: ["vendor-companies-count"],
    queryFn: () => listVendorCompanies({ limit: 1 }),
  })

  const { data: quotesData } = useQuery({
    queryKey: ["vendor-quotes-count"],
    queryFn: () => listVendorQuotes({ limit: 1 }),
  })

  const { data: approvalsData } = useQuery({
    queryKey: ["vendor-approvals-count"],
    queryFn: () => listVendorApprovals({ limit: 1 }),
  })

  const companiesCount = companiesData?.count ?? 0
  const quotesCount = quotesData?.count ?? 0
  const approvalsCount = approvalsData?.count ?? 0

  return (
    <div className="flex flex-col gap-y-6 max-w-6xl mx-auto p-4 md:p-8">
      <div>
        <Heading level="h1" className="text-2xl font-bold flex items-center gap-2">
          <BuildingStorefront className="w-6 h-6 text-ui-fg-base" />
          B2B Wholesale Management
        </Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Manage corporate buyer accounts, custom wholesale quote negotiations, and purchase order spending limit approvals.
        </Text>
      </div>

      {/* Overview 3 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Quotes Card */}
        <Container className="p-6 flex flex-col justify-between gap-y-5 hover:border-ui-border-strong transition-all shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 border border-blue-200 dark:border-blue-900/50">
              <DocumentText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Heading level="h3" className="text-lg font-bold">
                  Quotes
                </Heading>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-ui-bg-subtle text-ui-fg-subtle border">
                  {quotesCount}
                </span>
              </div>
              <Text size="small" className="text-ui-fg-subtle mt-1.5 leading-relaxed">
                Wholesale quote requests, custom unit price discounts, and shipping overrides for B2B buyers.
              </Text>
            </div>
          </div>
          <Link href="/b2b/quotes" className="w-full">
            <Button size="small" variant="secondary" className="w-full justify-between">
              <span>Manage Quotes</span>
              <span>&rarr;</span>
            </Button>
          </Link>
        </Container>

        {/* Companies Card */}
        <Container className="p-6 flex flex-col justify-between gap-y-5 hover:border-ui-border-strong transition-all shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 border border-purple-200 dark:border-purple-900/50">
              <BuildingStorefront className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Heading level="h3" className="text-lg font-bold">
                  Companies
                </Heading>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-ui-bg-subtle text-ui-fg-subtle border">
                  {companiesCount}
                </span>
              </div>
              <Text size="small" className="text-ui-fg-subtle mt-1.5 leading-relaxed">
                Corporate client profiles, assigned wholesale pricing groups, company employees, and credit limits.
              </Text>
            </div>
          </div>
          <Link href="/b2b/companies" className="w-full">
            <Button size="small" variant="secondary" className="w-full justify-between">
              <span>Manage Companies</span>
              <span>&rarr;</span>
            </Button>
          </Link>
        </Container>

        {/* Approvals Card */}
        <Container className="p-6 flex flex-col justify-between gap-y-5 hover:border-ui-border-strong transition-all shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 dark:border-emerald-900/50">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Heading level="h3" className="text-lg font-bold">
                  Approvals
                </Heading>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-ui-bg-subtle text-ui-fg-subtle border">
                  {approvalsCount}
                </span>
              </div>
              <Text size="small" className="text-ui-fg-subtle mt-1.5 leading-relaxed">
                Review and approve corporate orders that exceed authorized employee spending limits.
              </Text>
            </div>
          </div>
          <Link href="/b2b/approvals" className="w-full">
            <Button size="small" variant="secondary" className="w-full justify-between">
              <span>Review Approvals</span>
              <span>&rarr;</span>
            </Button>
          </Link>
        </Container>
      </div>
    </div>
  )
}
