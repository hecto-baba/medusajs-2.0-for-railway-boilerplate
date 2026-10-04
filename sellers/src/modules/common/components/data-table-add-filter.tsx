"use client"

import { Button, DropdownMenu } from "@medusajs/ui"

type DataTableAddFilterProps = {
  table: any
}

export const DataTableAddFilter = ({ table }: DataTableAddFilterProps) => {
  if (!table) return null

  const filtering = table.getFiltering ? table.getFiltering() : {}
  const enabledFilters = Object.keys(filtering || {})
  const allFilters = table.getFilters ? table.getFilters() : []
  const filterOptions = allFilters.filter(
    (filter: any) => !enabledFilters.includes(filter.id)
  )

  if (!allFilters.length) {
    return null
  }

  const getDefaultValue = (type: string) => {
    switch (type) {
      case "select":
      case "multiselect":
        return []
      case "string":
        return ""
      case "date":
      case "number":
      default:
        return null
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild disabled={filterOptions.length === 0}>
        <Button size="small" variant="secondary">
          Add filter
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        side="bottom"
        align="start"
        className="w-56 overflow-y-auto z-50 bg-ui-bg-base shadow-elevation-flyout rounded-lg p-1"
      >
        {filterOptions.map((filter: any) => (
          <DropdownMenu.Item
            key={filter.id}
            className="cursor-pointer px-2 py-1.5 text-sm hover:bg-ui-bg-base-hover rounded-md"
            onClick={(e) => {
              e.stopPropagation()
              if (table.addFilter) {
                table.addFilter({
                  id: filter.id,
                  value: getDefaultValue(filter.type),
                })
              }
            }}
          >
            {filter.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
