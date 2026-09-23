import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
  authenticate,
} from "@medusajs/framework/http";
import * as httpFramework from "@medusajs/framework/http";
import { createFindParams } from "@medusajs/medusa/api/utils/validators";
import { PostRentalConfigBodySchema } from "./admin/products/[id]/rental-config/route";
import { PostRentalStatusBodySchema } from "./admin/rentals/[id]/route";
import { GetRentalAvailabilitySchema } from "./store/products/[id]/rental-availability/route";
import { PostCartItemsRentalsBody } from "./store/carts/[id]/line-items/rentals/route";
import { PostCartItemsTicketsBody } from "./store/carts/[id]/line-items/tickets/route";
import { PostVenueBodySchema } from "./admin/venues/route";
import { PostTicketProductBodySchema } from "./admin/ticket-products/route";
import { GetTicketProductSeatsSchema } from "./store/ticket-products/[id]/seats/route";
import deliveriesMiddlewares from "./deliveries/[id]/middlewares";
import multer from "multer";
import { createDigitalProductsSchema } from "./admin/digital-products/validators";

// Safe fallback for allowFields if running Medusa Framework versions < 2.21.0
const allowFields = (httpFramework as any).allowFields || function (...fields: string[]) {
  return (req: any, res: any, next: any) => {
    req.allowed = req.allowed ?? [];
    req.allowed.push(...fields.flat());
    next();
  };
};

import { z } from "@medusajs/framework/zod";

const upload = multer({ storage: multer.memoryStorage() });
const GetDigitalProductsSchema = createFindParams().merge(
  z.object({
    product_id: z.string().optional(),
  })
);

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
    {
      methods: ["POST"],
      matcher: "/users",
      middlewares: [
        authenticate(["driver", "restaurant"], "bearer", {
          allowUnregistered: true,
        }),
      ],
    },
    {
      methods: ["POST", "DELETE"],
      matcher: "/restaurants/:id/**",
      middlewares: [
        authenticate(["restaurant", "user"], "bearer"),
      ],
    },
    {
      matcher: "/admin/digital-products",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(
          GetDigitalProductsSchema,
          {
            defaults: [
              "id",
              "name",
              "created_at",
              "updated_at",
              "deleted_at",
              "medias.*",
              "product_variant.*",
              "product_variant.product.*",
              "product_variant.prices.*",
            ],
            isList: true,
          }
        ),
      ],
    },
    {
      matcher: "/admin/digital-products",
      method: "POST",
      middlewares: [
        validateAndTransformBody(createDigitalProductsSchema),
      ],
    },
    {
      matcher: "/admin/digital-products/upload/:type",
      method: "POST",
      middlewares: [
        upload.array("files"),
      ],
    },
    {
      matcher: "/store/products",
      middlewares: [allowFields("variants.digital_product")],
    },
    {
      matcher: "/store/customers/me/**",
      middlewares: [
        authenticate("customer", ["bearer", "session"]),
      ],
    },
    {
      matcher: "/store/quotes",
      middlewares: [
        authenticate("customer", ["bearer", "session"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    {
      matcher: "/store/quotes/**",
      middlewares: [
        authenticate("customer", ["bearer", "session"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    {
      matcher: "/store/approvals",
      middlewares: [
        authenticate("customer", ["bearer", "session"]),
      ],
    },
    {
      matcher: "/store/approvals/**",
      middlewares: [
        authenticate("customer", ["bearer", "session"]),
      ],
    },
    {
      matcher: "/store/orders/:id",
      middlewares: [
        authenticate("customer", ["bearer", "session"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    ...deliveriesMiddlewares.routes!
  ]
})