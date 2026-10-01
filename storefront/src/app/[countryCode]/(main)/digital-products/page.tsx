import { Metadata } from "next"

import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import DigitalProductsTemplate from "@modules/digital-products/templates"

export const metadata: Metadata = {
  title: "Digital Products",
  description: "Browse downloadable e-books, software, and digital assets.",
}

type Params = {
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
  }>
  params: Promise<{
    countryCode: string
  }>
}

export default async function DigitalProductsPage({ searchParams, params }: Params) {
  const { sortBy, page } = await searchParams
  const { countryCode } = await params

  return (
    <DigitalProductsTemplate
      sortBy={sortBy}
      page={page}
      countryCode={countryCode}
    />
  )
}
