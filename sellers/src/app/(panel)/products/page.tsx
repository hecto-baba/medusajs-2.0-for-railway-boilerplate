import { getInitialVendorProducts } from "@lib/data/vendor-products-server"
import { ProductsTable } from "@modules/products/components/products-table"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Products" }

export default async function ProductsPage() {
  const initialData = await getInitialVendorProducts()

  return (
    <div className="p-6">
      <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg overflow-hidden">
        <ProductsTable initialData={initialData} />
      </div>
    </div>
  )
}
