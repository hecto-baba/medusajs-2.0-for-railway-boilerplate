"use client"

import {
  type VendorInventoryItem,
  type VendorInventoryLevel,
} from "@lib/data/vendor-client"
import {
  Button,
  Container,
  Heading,
  Table,
  Text,
} from "@medusajs/ui"
import { useState } from "react"
import { ManageLocationsDrawer } from "../forms/manage-locations-drawer"
import { AdjustStockDrawer } from "../forms/adjust-stock-drawer"

export const LocationLevelsSection = ({
  item,
}: {
  item: VendorInventoryItem
}) => {
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<VendorInventoryLevel | null>(
    null
  )

  const levels = item.location_levels ?? []

  return (
    <>
      <Container className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Heading level="h2">Location Stock Levels</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Stock counts across active fulfillment warehouses.
            </Text>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setIsManageOpen(true)}
          >
            Manage Locations
          </Button>
        </div>

        {levels.length === 0 ? (
          <div className="border-ui-border-base bg-ui-bg-subtle flex flex-col items-center justify-center rounded-lg border py-8 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              This inventory item is not currently stocked at any warehouse.
            </Text>
            <Button
              size="small"
              variant="secondary"
              className="mt-3"
              onClick={() => setIsManageOpen(true)}
            >
              Add Stock Location
            </Button>
          </div>
        ) : (
          <div className="border-ui-border-base overflow-hidden rounded-lg border">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Location</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">
                    In Stock
                  </Table.HeaderCell>
                  <Table.HeaderCell className="text-right">
                    Reserved
                  </Table.HeaderCell>
                  <Table.HeaderCell className="text-right">
                    Available
                  </Table.HeaderCell>
                  <Table.HeaderCell className="w-24 text-right">
                    Actions
                  </Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {levels.map((lvl) => {
                  const locationName = Array.isArray(lvl.stock_locations)
                    ? lvl.stock_locations[0]?.name
                    : lvl.stock_locations?.name || lvl.location_id

                  const locationAddress = Array.isArray(lvl.stock_locations)
                    ? lvl.stock_locations[0]?.address
                    : lvl.stock_locations?.address

                  const stocked = Number(lvl.stocked_quantity ?? 0)
                  const reserved = Number(lvl.reserved_quantity ?? 0)
                  const available = stocked - reserved

                  return (
                    <Table.Row key={lvl.id}>
                      <Table.Cell>
                        <div className="flex flex-col">
                          <Text size="small" weight="plus">
                            {locationName}
                          </Text>
                          {locationAddress && (
                            <Text size="xsmall" className="text-ui-fg-subtle">
                              {[
                                locationAddress.city,
                                locationAddress.country_code?.toUpperCase(),
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </Text>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-right font-medium">
                        {stocked}
                      </Table.Cell>
                      <Table.Cell className="text-right text-ui-fg-muted font-medium">
                        {reserved}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <span
                          className={`font-semibold ${
                            available > 0
                              ? "text-ui-fg-interactive"
                              : "text-ui-fg-error"
                          }`}
                        >
                          {available}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => setSelectedLevel(lvl)}
                        >
                          Adjust
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table>
          </div>
        )}
      </Container>

      <ManageLocationsDrawer
        item={item}
        open={isManageOpen}
        onOpenChange={setIsManageOpen}
      />

      {selectedLevel && (
        <AdjustStockDrawer
          item={item}
          level={selectedLevel}
          open={!!selectedLevel}
          onOpenChange={(open) => !open && setSelectedLevel(null)}
        />
      )}
    </>
  )
}
