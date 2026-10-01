import { defineRouteConfig } from "@medusajs/admin-sdk"
import RestaurantsPage from "../../restaurants/page"

export const config = defineRouteConfig({
  label: "Restaurants",
})

export default RestaurantsPage