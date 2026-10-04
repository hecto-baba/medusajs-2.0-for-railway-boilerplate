import { Metadata } from "next"
import RestaurantsView, { Restaurant } from "./_components/restaurants-view"

export const metadata: Metadata = {
  title: "Restaurants",
  description: "Browse local restaurants and menus.",
}

const backendUrl =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

async function load(path: string): Promise<Restaurant[] | null> {
  try {
    const res = await fetch(`${backendUrl}${path}`, {
      next: { revalidate: 30, tags: ["restaurants"] },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.restaurants ?? []
  } catch {
    return null
  }
}

// Fetched on the server so the list is part of the initial HTML (the client
// version rendered a "Loading..." paragraph first, which became the LCP).
export default async function RestaurantsPage() {
  const restaurants =
    (await load("/restaurants?currency_code=eur")) ??
    (await load("/store/restaurants"))

  return <RestaurantsView initialRestaurants={restaurants} />
}
