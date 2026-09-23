import type { CreateApiKeyDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createApiKeysWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorApiKeyWorkflowInput = {
  vendor_id?: string
  vendor_admin_id?: string
  api_key: CreateApiKeyDTO
}

export const createVendorApiKeyWorkflow = createWorkflow(
  "create-vendor-api-key",
  (input: CreateVendorApiKeyWorkflowInput) => {
    const keyData = transform({ input }, (data) => ({
      api_keys: [data.input.api_key],
    }))

    const createdKeys = createApiKeysWorkflow.runAsStep({
      input: keyData,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins-for-api-key" })

    const linksToCreate = transform(
      { input, createdKeys, vendorAdmins },
      (data) => {
        const vendorId =
          data.input.vendor_id || data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error("Cannot link api key: Authenticated vendor profile does not exist.")
        }
        return data.createdKeys.map((k) => ({
          [MARKETPLACE_MODULE]: {
            vendor_id: vendorId,
          },
          [Modules.API_KEY]: {
            api_key_id: k.id,
          },
        }))
      }
    )

    createRemoteLinkStep(linksToCreate)

    const { data: apiKeys } = useQueryGraphStep({
      entity: "api_key",
      fields: [
        "id",
        "title",
        "type",
        "token",
        "redacted",
        "created_at",
        "updated_at",
        "revoked_at",
      ],
      filters: { id: createdKeys[0].id },
    }).config({ name: "retrieve-created-vendor-api-key" })

    return new WorkflowResponse({ api_key: apiKeys[0] })
  }
)
