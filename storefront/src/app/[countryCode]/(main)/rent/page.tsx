import { Metadata } from "next"

import RentTemplate from "@modules/rent/templates"

export const metadata: Metadata = {
  title: "Rent",
  description: "Rent items by the hour, day, week or month.",
}

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ unit?: string }>
}

export default async function RentPage({ params, searchParams }: Props) {
  const { countryCode } = await params
  const { unit } = await searchParams

  return <RentTemplate countryCode={countryCode} unit={unit} />
}
