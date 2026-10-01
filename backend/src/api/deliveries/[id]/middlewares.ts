import { 
  authenticate, 
  defineMiddlewares, 
} from "@medusajs/framework/http"
import { isDeliveryRestaurant } from "../../utils/is-delivery-restaurant"
import { isDeliveryDriver } from "../../utils/is-delivery-driver"

export default defineMiddlewares({
  routes: [
    // restaurant routes
    {
      matcher: "/deliveries/:id/accept",
      middlewares: [
        authenticate(["restaurant", "user"], ["bearer", "session", "api-key"], {
          allowUnauthenticated: true,
        }),
        // @ts-ignore
        isDeliveryRestaurant
      ]
    },
    {
      matcher: "/deliveries/:id/prepare",
      middlewares: [
        authenticate(["restaurant", "user"], ["bearer", "session", "api-key"], {
          allowUnauthenticated: true,
        }),
        // @ts-ignore
        isDeliveryRestaurant
      ]
    },
    {
      matcher: "/deliveries/:id/ready",
      middlewares: [
        authenticate(["restaurant", "user"], ["bearer", "session", "api-key"], {
          allowUnauthenticated: true,
        }),
        // @ts-ignore
        isDeliveryRestaurant
      ]
    },
    // driver routes
    {
      matcher: "/deliveries/:id/claim",
      middlewares: [
        authenticate(["driver", "user"], ["bearer", "session", "api-key"], {
          allowUnauthenticated: true,
        }),
      ]
    },
    {
      matcher: "/deliveries/:id/pick-up",
      middlewares: [
        authenticate(["driver", "user"], ["bearer", "session", "api-key"], {
          allowUnauthenticated: true,
        }),
        // @ts-ignore
        isDeliveryDriver
      ]
    },
    {
      matcher: "/deliveries/:id/complete",
      middlewares: [
        authenticate(["driver", "user"], ["bearer", "session", "api-key"], {
          allowUnauthenticated: true,
        }),
        // @ts-ignore
        isDeliveryDriver
      ]
    },
  ]
})
