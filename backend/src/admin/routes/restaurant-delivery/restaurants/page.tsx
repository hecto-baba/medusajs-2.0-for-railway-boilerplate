import { defineRouteConfig } from "@medusajs/admin-sdk"
import RestaurantsPage from "../../restaurants/page"

export const config = defineRouteConfig({
  label: "Restaurants",
  rank: 1,
})

export default RestaurantsPage