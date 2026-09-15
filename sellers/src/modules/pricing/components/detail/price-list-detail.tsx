"use client"

import {
  getVendorPriceList,
} from "@lib/data/vendor-client"
import { useBreadcrumbTitle } from "@modules/layout"
import { ArrowLeft } from "@medusajs/icons"
import { Button, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { ConfigurationSection } from "./configuration-section"
import { GeneralSection } from "./general-section"
import { ProductsSection } from "./products-section"

type PriceListDetailProps = {
  id: string
}

export const PriceListDetail = ({ id }: PriceListDetailProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-price-list", id],
    queryFn: () => getVendorPriceList(id),
  })

  const priceList = data?.price_list

  useBreadcrumbTitle(priceList?.title)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text size="small" className="text-ui-fg-subtle">
          Loading price list details...
        </Text>
      </div>
    )
  }

  if (error || !priceList) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-y-4">
        <Text size="small" className="text-ui-fg-error">
          Price list not found or access denied.
        </Text>
        <Link href="/pricing">
          <Button variant="secondary" size="small">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Price Lists
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-3 pb-12">
      {/* Medusa 2-column detail layout: Main 2 cols, Sidebar 1 col on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        {/* Main Column */}
        <div className="lg:col-span-2 flex flex-col gap-y-3">
          <GeneralSection priceList={priceList} />
          <ProductsSection priceList={priceList} />
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-1 flex flex-col gap-y-3">
          <ConfigurationSection priceList={priceList} />
        </div>
      </div>
    </div>
  )
}
