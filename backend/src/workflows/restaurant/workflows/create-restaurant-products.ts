import { createProductsWorkflow, createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { RESTAURANT_MODULE } from "../../../modules/restaurant"

type WorkflowInput = {
  products: CreateProductWorkflowInputDTO[]
  restaurant_id: string
}

export const createRestaurantProductsWorkflow = createWorkflow(
  "create-restaurant-products-workflow",
  function (input: WorkflowInput) {
    // Dishes are made to order, not counted in a warehouse. Leaving inventory
    // management on makes add-to-cart fail with "Sales channel ... is not
    // associated with any stock location" unless stock is set up per variant.
    const productsInput = transform({ input }, (data) =>
      data.input.products.map((product) => ({
        ...product,
        variants: product.variants?.map((variant) => ({
          ...variant,
          manage_inventory: false,
        })),
      }))
    )
    const products = createProductsWorkflow.runAsStep({
      input: {
        products: productsInput,
      },
    })
    const links = transform({ products, input }, (data) =>
      data.products.map((product) => ({
        [RESTAURANT_MODULE]: {
          restaurant_id: data.input.restaurant_id,
        },
        [Modules.PRODUCT]: {
          product_id: product.id,
        },
      }))
    )
    createRemoteLinkStep(links)
    return new WorkflowResponse(products)
  }
)
