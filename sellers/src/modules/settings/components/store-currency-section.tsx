"use client"

import { getVendorTaxonomy } from "@lib/data/vendor-client"
import { CurrencyDollar, InformationCircleSolid } from "@medusajs/icons"
import { Badge, Container, Heading, Table, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"

const CURRENCY_NAMES: Record<string, { name: string; symbol: string }> = {
  usd: { name: "US Dollar", symbol: "$" },
  eur: { name: "Euro", symbol: "€" },
  gbp: { name: "British Pound", symbol: "£" },
  cad: { name: "Canadian Dollar", symbol: "CA$" },
  aud: { name: "Australian Dollar", symbol: "AU$" },
  inr: { name: "Indian Rupee", symbol: "₹" },
  jpy: { name: "Japanese Yen", symbol: "¥" },
  cny: { name: "Chinese Yuan", symbol: "¥" },
  sgd: { name: "Singapore Dollar", symbol: "SG$" },
  chf: { name: "Swiss Franc", symbol: "CHF" },
  aed: { name: "United Arab Emirates Dirham", symbol: "AED" },
}

export const StoreCurrencySection = () => {
  const { data: taxonomy, isLoading } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: () => getVendorTaxonomy(),
  })

  const currencies = taxonomy?.currencies ?? []
  const defaultCurrency = currencies.find((c) => c.is_default) || currencies[0]

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Currencies</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Manage the currencies that your store supports for products and checkout.
          </Text>
        </div>
        {defaultCurrency && (
          <div className="flex items-center gap-x-2">
            <Text size="small" className="text-ui-fg-subtle">
              Default:
            </Text>
            <Badge size="small" color="green">
              {defaultCurrency.code.toUpperCase()}
            </Badge>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell className="w-1/3">Currency</Table.HeaderCell>
              <Table.HeaderCell className="w-1/4">Code</Table.HeaderCell>
              <Table.HeaderCell>Symbol</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Status</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <td colSpan={4} className="h-24 text-center text-ui-fg-subtle">
                  <Text size="small">Loading currencies...</Text>
                </td>
              </Table.Row>
            ) : currencies.length === 0 ? (
              <Table.Row>
                <td colSpan={4} className="h-24 text-center text-ui-fg-subtle">
                  <div className="flex items-center justify-center gap-x-2">
                    <InformationCircleSolid className="h-4 w-4" />
                    <Text size="small">No currencies configured.</Text>
                  </div>
                </td>
              </Table.Row>
            ) : (
              currencies.map((curr) => {
                const info = CURRENCY_NAMES[curr.code.toLowerCase()] || {
                  name: curr.code.toUpperCase(),
                  symbol: curr.code.toUpperCase(),
                }
                return (
                  <Table.Row key={curr.code}>
                    <Table.Cell>
                      <div className="flex items-center gap-x-2">
                        <CurrencyDollar className="h-4 w-4 text-ui-fg-muted" />
                        <Text size="small" weight="plus" className="text-ui-fg-base">
                          {info.name}
                        </Text>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall">{curr.code.toUpperCase()}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle">
                        {info.symbol}
                      </Text>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {curr.is_default ? (
                        <Badge size="small" color="green">
                          Default
                        </Badge>
                      ) : (
                        <Badge size="small" color="grey">
                          Supported
                        </Badge>
                      )}
                    </Table.Cell>
                  </Table.Row>
                )
              })
            )}
          </Table.Body>
        </Table>
      </div>
    </Container>
  )
}
