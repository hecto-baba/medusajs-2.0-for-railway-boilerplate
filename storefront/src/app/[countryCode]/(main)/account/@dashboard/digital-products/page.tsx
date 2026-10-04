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
      <div className="mb-4 flex flex-col gap-y-2 rounded-large bg-card p-5 shadow-lift">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Digital Products</h1>
        <p className="text-muted">
          View the digital products you&apos;ve purchased and download them.
        </p>
      </div>
      <div>
        <DigitalProductsList digitalProducts={digitalProducts} />
      </div>
    </div>
  )
}
