import { createWorkflow, WorkflowResponse, when, transform } from "@medusajs/framework/workflows-sdk"
import { setAuthAppMetadataStep } from "@medusajs/medusa/core-flows"
import { createRestaurantAdminStep, CreateRestaurantAdminInput } from "../steps/create-restaurant-admin"
import { createDriverStep, CreateDriverInput } from "../steps/create-driver"

export type CreateUserWorkflowInput = {
  user: (CreateRestaurantAdminInput | CreateDriverInput) & { actor_type: "restaurant" | "driver" }
  auth_identity_id: string
}

export const createUserWorkflow = createWorkflow(
  "create-user-workflow",
  function (input: CreateUserWorkflowInput) {
    const restaurantUser = when(input, (input) => input.user.actor_type === "restaurant").then(() => {
      return createRestaurantAdminStep(input.user as CreateRestaurantAdminInput)
    })
    const driverUser = when(input, (input) => input.user.actor_type === "driver").then(() => {
      return createDriverStep(input.user as CreateDriverInput)
    })
    const { user, authUserInput } = transform({ input, restaurantUser, driverUser }, (data) => {
        const user = data.restaurantUser || data.driverUser
        return {
          user,
          authUserInput: {
            authIdentityId: data.input.auth_identity_id,
            actorType: data.input.user.actor_type,
            value: user?.id || "",
          },
        }
      }
    )
    setAuthAppMetadataStep(authUserInput)
    return new WorkflowResponse({ user })
  }
)
