import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery
} from "@medusajs/framework/http";
import { createFindParams } from "@medusajs/medusa/api/utils/validators";
import { PostRentalConfigBodySchema } from "./admin/products/[id]/rental-config/route";
import { PostRentalStatusBodySchema } from "./admin/rentals/[id]/route";
import { GetRentalAvailabilitySchema } from "./store/products/[id]/rental-availability/route";
import { PostCartItemsRentalsBody } from "./store/carts/[id]/line-items/rentals/route";
import { PostVenueBodySchema } from "./admin/venues/route";
import { PostTicketProductBodySchema } from "./admin/ticket-products/route";
import { GetTicketProductSeatsSchema } from "./store/ticket-products/[id]/seats/route";

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/products/:id/rental-config",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostRentalConfigBodySchema)
      ]
    },
    {
      matcher: "/admin/rentals/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostRentalStatusBodySchema)
      ]
    },
    {
      matcher: "/store/products/:id/rental-availability",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetRentalAvailabilitySchema, {})
      ]
    },
    {
      matcher: "/store/carts/:id/line-items/rentals",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostCartItemsRentalsBody)
      ]
    },
    {
      matcher: "/admin/venues",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVenueBodySchema)
      ]
    },
    {
      matcher: "/admin/venues",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(createFindParams(), {
          isList: true,
          defaults: ["id", "name", "address", "rows.*"]
        })
      ]
    },
    {
      matcher: "/admin/ticket-products",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostTicketProductBodySchema)
      ]
    },
    {
      matcher: "/admin/ticket-products",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(createFindParams(), {
          isList: true,
          defaults: [
            "id",
            "product_id",
            "dates",
            "venue.*",
            "venue.rows.*",
            "variants.*",
            "product.*"
          ]
        })
      ]
    },
    {
      matcher: "/store/ticket-products/:id/seats",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetTicketProductSeatsSchema, {})
      ]
    }
  ]
})