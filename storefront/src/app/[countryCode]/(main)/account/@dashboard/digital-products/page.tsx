import { Metadata } from "next"

import { getCustomerDigitalProducts } from "../../../../../../lib/data/digital-products"
import { DigitalProductsList } from "../../../../../../modules/account/components/digital-products-list"

export const metadata: Metadata = {
  title: "Digital Products",
  description: "Overview of your purchased digital products.",
}

export default async function DigitalProducts() {
  const digitalProducts = (await getCustomerDigitalProducts().catch(() => [])) || []

  return (
    <div className="w-full" data-testid="digital-products-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Digital Products</h1>
        <p className="text-base-regular">
          View the digital products you've purchased and download them.
        </p>
      </div>
      <div>
        <DigitalProductsList digitalProducts={digitalProducts} />
      </div>
    </div>
  )
}
