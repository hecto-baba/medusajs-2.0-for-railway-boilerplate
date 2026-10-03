"use client"

import { ProductForm } from "./product-form"

export function NewProductView() {
  return (
    <div className="space-y-6">
      {/* Canonical Medusa Product Creation Form */}
      <ProductForm />
    </div>
  )
}

