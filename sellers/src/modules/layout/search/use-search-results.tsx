"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { matchSorter } from "match-sorter"
import { useEffect, useMemo, useState } from "react"
import { searchVendor } from "@lib/data/vendor-client"
import { SEARCH_AREA_LABELS } from "./constants"
import { DynamicSearchResult, SearchArea, Shortcut, ShortcutType, StaticSearchResult } from "./types"
import { useGlobalShortcuts } from "./use-keybind"

type UseSearchProps = {
  q?: string
  limit: number
  area?: SearchArea
}

const DYNAMIC_SEARCH_ENTITIES = [
  "order",
  "product",
  "productVariant",
  "category",
  "collection",
  "customer",
  "customerGroup",
  "inventory",
  "promotion",
  "campaign",
  "priceList",
  "venue",
  "show",
  "location",
  "returnReason",
  "refundReason",
] as const

type DynamicSearchEntity = (typeof DYNAMIC_SEARCH_ENTITIES)[number]

function isDynamicSearchEntity(area: SearchArea): area is DynamicSearchEntity {
  return (DYNAMIC_SEARCH_ENTITIES as readonly string[]).includes(area)
}

const useDebouncedSearch = (value: string | undefined, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export const useSearchResults = ({
  q,
  limit,
  area = "all",
}: UseSearchProps) => {
  const staticResults = useStaticSearchResults(area)
  const { dynamicResults, isFetching } = useDynamicSearchResults(area, limit, q)

  return {
    staticResults,
    dynamicResults,
    isFetching,
  }
}

const useStaticSearchResults = (currentArea: SearchArea) => {
  const globalCommands = useGlobalShortcuts()

  const results = useMemo(() => {
    const groups = new Map<ShortcutType, Shortcut[]>()

    globalCommands.forEach((command) => {
      const group = groups.get(command.type) || []
      group.push(command)
      groups.set(command.type, group)
    })

    let filteredGroups: [ShortcutType, Shortcut[]][]

    switch (currentArea) {
      case "all":
        filteredGroups = Array.from(groups)
        break
      case "navigation":
        filteredGroups = Array.from(groups).filter(
          ([type]) => type === "pageShortcut" || type === "settingShortcut"
        )
        break
      case "command":
        filteredGroups = Array.from(groups).filter(
          ([type]) => type === "commandShortcut"
        )
        break
      default:
        filteredGroups = []
    }

    const headingMap: Record<ShortcutType, string> = {
      pageShortcut: "Jump to",
      settingShortcut: "Settings",
      commandShortcut: "Commands",
    }

    return filteredGroups.map(([title, items]) => ({
      title,
      heading: headingMap[title] || title,
      items,
    }))
  }, [globalCommands, currentArea])

  return results
}

type TransformFunction = (item: any) => {
  id: string
  title: string
  subtitle?: string
  to: string
  value: string
  thumbnail?: string
}

const transformMap: Record<DynamicSearchEntity, { transform: TransformFunction }> = {
  order: {
    transform: (order: any) => ({
      id: order.id,
      title: `#${order.display_id}`,
      subtitle: order.email ?? undefined,
      to: `/orders/${order.id}`,
      value: `order:${order.id}`,
    }),
  },
  product: {
    transform: (product: any) => ({
      id: product.id,
      title: product.title,
      to: `/products/${product.id}`,
      thumbnail: product.thumbnail ?? undefined,
      value: `product:${product.id}`,
    }),
  },
  productVariant: {
    transform: (variant: any) => ({
      id: variant.id,
      title: variant.title || "Variant",
      subtitle: variant.sku ?? undefined,
      to: `/products/${variant.product_id}`,
      value: `variant:${variant.id}`,
    }),
  },
  category: {
    transform: (category: any) => ({
      id: category.id,
      title: category.name,
      to: `/products/categories`,
      value: `category:${category.id}`,
    }),
  },
  inventory: {
    transform: (inventory: any) => ({
      id: inventory.id,
      title: inventory.title ?? "",
      subtitle: inventory.sku ?? undefined,
      to: `/inventory`,
      value: `inventory:${inventory.id}`,
    }),
  },
  customer: {
    transform: (customer: any) => {
      const name = [customer.first_name, customer.last_name]
        .filter(Boolean)
        .join(" ")
      return {
        id: customer.id,
        title: name || customer.email,
        subtitle: name ? customer.email : undefined,
        to: `/customers/${customer.id}`,
        value: `customer:${customer.id}`,
      }
    },
  },
  customerGroup: {
    transform: (customerGroup: any) => ({
      id: customerGroup.id,
      title: customerGroup.name,
      to: `/customers/groups/${customerGroup.id}`,
      value: `customerGroup:${customerGroup.id}`,
    }),
  },
  collection: {
    transform: (collection: any) => ({
      id: collection.id,
      title: collection.title,
      to: `/products/collections`,
      value: `collection:${collection.id}`,
    }),
  },
  promotion: {
    transform: (promotion: any) => ({
      id: promotion.id,
      title: promotion.code,
      to: `/promotions/${promotion.id}`,
      value: `promotion:${promotion.id}`,
    }),
  },
  campaign: {
    transform: (campaign: any) => ({
      id: campaign.id,
      title: campaign.name,
      to: `/promotions/campaigns/${campaign.id}`,
      value: `campaign:${campaign.id}`,
    }),
  },
  priceList: {
    transform: (priceList: any) => ({
      id: priceList.id,
      title: priceList.title,
      to: `/pricing/${priceList.id}`,
      value: `priceList:${priceList.id}`,
    }),
  },
  venue: {
    transform: (venue: any) => ({
      id: venue.id,
      title: venue.name,
      to: `/venues/${venue.id}`,
      value: `venue:${venue.id}`,
    }),
  },
  show: {
    transform: (show: any) => ({
      id: show.id,
      title: show.title,
      to: `/shows/${show.id}`,
      value: `show:${show.id}`,
    }),
  },
  location: {
    transform: (location: any) => ({
      id: location.id,
      title: location.name,
      to: `/settings/locations`,
      value: `location:${location.id}`,
    }),
  },
  returnReason: {
    transform: (returnReason: any) => ({
      id: returnReason.id,
      title: returnReason.label,
      subtitle: returnReason.value,
      to: `/settings/return-reasons`,
      value: `returnReason:${returnReason.id}`,
    }),
  },
  refundReason: {
    transform: (refundReason: any) => ({
      id: refundReason.id,
      title: refundReason.label,
      subtitle: refundReason.value,
      to: `/settings/refund-reasons`,
      value: `refundReason:${refundReason.id}`,
    }),
  },
}

function transformSearchResultGroup(
  group: { entity: string; count: number; data: any[] },
  limit: number
): DynamicSearchResult | undefined {
  if (!isDynamicSearchEntity(group.entity as SearchArea)) {
    return undefined
  }

  const area = group.entity as DynamicSearchEntity
  const transform = transformMap[area]?.transform

  if (!transform || !Array.isArray(group.data)) {
    return undefined
  }

  return {
    title: SEARCH_AREA_LABELS[area] || area,
    area,
    hasMore: group.count > limit,
    count: group.count,
    items: group.data.map(transform),
  }
}

const useDynamicSearchResults = (
  currentArea: SearchArea,
  limit: number,
  q?: string
) => {
  const debouncedSearch = useDebouncedSearch(q, 300)

  const entity = useMemo(() => {
    if (currentArea === "all") {
      return undefined
    }

    if (isDynamicSearchEntity(currentArea)) {
      return currentArea
    }

    return undefined
  }, [currentArea])

  const isDynamicArea =
    currentArea === "all" || isDynamicSearchEntity(currentArea)

  const { data, isFetching } = useQuery({
    queryKey: ["vendor-search", debouncedSearch, limit, entity],
    queryFn: () =>
      searchVendor({
        q: debouncedSearch,
        limit,
        entity,
      }),
    enabled: Boolean(debouncedSearch) && isDynamicArea,
    placeholderData: keepPreviousData,
  })

  const dynamicResults = useMemo(() => {
    if (!q || !data?.results?.length) {
      return []
    }

    return data.results
      .map((group) => transformSearchResultGroup(group, limit))
      .filter(
        (group): group is DynamicSearchResult =>
          !!group && group.items.length > 0
      )
  }, [q, data, limit])

  return {
    dynamicResults,
    isFetching: Boolean(debouncedSearch) && isDynamicArea && isFetching,
  }
}
