import {
  createWorkflow,
  WorkflowResponse,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  useQueryGraphStep,
  createRemoteLinkStep,
  acquireLockStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { createEoiConfigurationStep } from "./steps/create-eoi-configuration"
import { updateEoiConfigurationStep } from "./steps/update-eoi-configuration"
import { EOI_MODULE } from "../modules/expression-of-interest"

type UpsertEoiConfigWorkflowInput = {
  variant_id: string
  value_type?: "fixed" | "percentage"
  value_amount?: number
  status?: "active" | "inactive"
}

/**
 * Mirrors upsert-rental-config.ts's shape, but keyed by variant_id rather
 * than product_id (see docs/plan/EOI_VARIANT_LEVEL_CONFIG_PLAN.md): find
 * existing config by variant_id, branch create vs. update, link on first
 * creation only. The link payload's `product_variant_id` key on the
 * Modules.PRODUCT side matches create-ticket-product.ts's own
 * product-variant linking, confirmed against the real linkable shape
 * (ProductModule.linkable.productVariant.linkable === "product_variant_id").
 *
 * Locked around the whole read-then-branch-then-write (fix #3 of
 * docs/plan/EOI_VARIANT_LEVEL_FIX_EXECUTION_PLAN.md): without this, two
 * concurrent calls for the same variant_id can both see "no config exists"
 * and both take the create branch. The unique index on
 * eoi_configuration.variant_id (migration Migration20261003120000) is the
 * hard backstop if the lock is ever bypassed (e.g. process crash mid-lock);
 * this lock is what keeps the normal concurrent-click case from surfacing a
 * raw DB constraint-violation error to the caller.
 */
export const upsertEoiConfigWorkflow = createWorkflow(
  "upsert-eoi-config",
  (input: UpsertEoiConfigWorkflowInput) => {
    acquireLockStep({
      key: input.variant_id,
      timeout: 2,
      ttl: 10,
    })

    const { data: variants } = useQueryGraphStep({
      entity: "product_variant",
      fields: ["id", "eoi_configuration.*"],
      filters: { id: input.variant_id },
      options: {
        throwIfKeyNotFound: true,
      },
    }).config({ name: "retrieve-variant-eoi-config" })

    const createdConfig = when({ variants }, (data) => {
      return !data.variants[0]?.eoi_configuration
    }).then(() => {
      const newConfig = createEoiConfigurationStep({
        variant_id: input.variant_id,
        value_type: input.value_type,
        value_amount: input.value_amount,
        status: input.status,
      })

      // Key order matters here, not just which keys are present: the link
      // was registered as defineLink(EoiModule.linkable.eoiConfiguration,
      // { linkable: ProductModule.linkable.productVariant, ... }) -
      // EOI_MODULE first, Modules.PRODUCT second - and the remote-link
      // registry's lookup key is built from createRemoteLinkStep's payload
      // in that same object-key order (confirmed live: the registered pair
      // is "expressionOfInterest-eoi_configuration_id-product-product_variant_id",
      // not the reverse). Swapping this order silently throws "Module to
      // type ... was not found" at runtime despite using the right keys.
      const linkData = transform({ newConfig, variant_id: input.variant_id }, (data) => {
        return [
          {
            [EOI_MODULE]: {
              eoi_configuration_id: data.newConfig.id,
            },
            [Modules.PRODUCT]: {
              product_variant_id: data.variant_id,
            },
          },
        ]
      })

      createRemoteLinkStep(linkData)

      return newConfig
    })

    // @ts-ignore
    const updatedConfig = when({ variants }, (data) => {
      return !!data.variants[0]?.eoi_configuration
    }).then(() => {
      return updateEoiConfigurationStep({
        id: variants[0].eoi_configuration!.id,
        value_type: input.value_type,
        value_amount: input.value_amount,
        status: input.status,
      })
    })

    const eoiConfig = transform({ updatedConfig, createdConfig }, (data) => {
      return data.updatedConfig || data.createdConfig
    })

    releaseLockStep({
      key: input.variant_id,
    })

    return new WorkflowResponse(eoiConfig)
  }
)
