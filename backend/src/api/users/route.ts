import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createUserSchema } from "./validation-schemas"
import { createUserWorkflow, CreateUserWorkflowInput } from "../../workflows/user/workflows/create-user"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { auth_identity_id } = req.auth_context
  const validatedBody = createUserSchema.parse(req.body)
  const { result } = await createUserWorkflow(req.scope).run({
    input: {
      user: validatedBody,
      auth_identity_id,
    } as CreateUserWorkflowInput,
  })
  res.status(200).json({ user: result.user })
}
