import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery
} from "@medusajs/framework/http";
import { createFindParams } from "@medusajs/medusa/api/utils/validators";
import { PostRentalConfigBodySchema } from "./admin/products/[id]/rental-config/route";
import { PostRentalStatusBodySchema } from "./admin/rentals/[id]/route";
import { GetRentalAvailabilitySchema } from "./store/products/[id]/rental-availability/route";
import { PostCartItemsRentalsBody } from "./store/carts/[id]/line-items/rentals/route";
import { PostCartItemsTicketsBody } from "./store/carts/[id]/line-items/tickets/route";
import { PostVenueBodySchema } from "./admin/venues/route";
import { PostTicketProductBodySchema } from "./admin/ticket-products/route";
import { GetTicketProductSeatsSchema } from "./store/ticket-products/[id]/seats/route";
import { PostVendorCreateSchema } from "./vendors/route";
import { AdminCreateProduct } from "@medusajs/medusa/api/admin/products/validators";

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
      matcher: "/store/carts/:id/line-items/tickets",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostCartItemsTicketsBody)
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
    },
    // allowUnregistered admits the JWT handed out by
    // /auth/vendor/emailpass/register, which has an auth identity but no vendor
    // admin behind it yet. The route itself rejects tokens that already carry an
    // actor_id, so this cannot be used to register a second time.
    {
      matcher: "/vendors",
      methods: ["POST"],
      middlewares: [
        authenticate("vendor", ["session", "bearer"], {
          allowUnregistered: true
        }),
        validateAndTransformBody(PostVendorCreateSchema)
      ]
    },
    {
      matcher: "/vendors/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/products",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminCreateProduct)
      ]
    }
  ]
})