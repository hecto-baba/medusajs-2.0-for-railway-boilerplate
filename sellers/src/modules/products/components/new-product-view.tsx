"use client"

import { useRouter } from "next/navigation"
import { ProductCreateFlow } from "./product-create-flow"

/**
 * Direct link to the create flow (/products/new). From the products list the
 * Add Product button opens the same flow in place, without a page change.
 */
export function NewProductView() {
  const router = useRouter()

  return <ProductCreateFlow open onClose={() => router.push("/products")} />
}
