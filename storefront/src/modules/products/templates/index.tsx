import React, { Suspense } from "react"

import Breadcrumbs from "@modules/common/components/breadcrumbs"
import ImageGallery from "@modules/products/components/image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import ProductActionsWrapper from "./product-actions-wrapper"
import { HttpTypes } from "@medusajs/types"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  return (
    <>
      <div className="content-container py-6" data-testid="product-container">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            product.collection
              ? {
                  label: product.collection.title,
                  href: `/collections/${product.collection.handle}`,
                }
              : { label: "All products", href: "/store" },
            { label: product.title },
          ]}
        />
        <div className="grid items-start gap-8 small:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] small:gap-10">
          <ImageGallery images={product?.images || []} />
          <div className="flex min-w-0 flex-col gap-y-6 small:sticky small:top-40">
            <ProductInfo product={product} />
            <Suspense
              fallback={
                <ProductActions
                  disabled={true}
                  product={product}
                  region={region}
                />
              }
            >
              <ProductActionsWrapper product={product} region={region} />
            </Suspense>
            <ProductTabs product={product} />
          </div>
        </div>
      </div>
      <div
        className="content-container my-12 small:my-16"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </>
  )
}

export default ProductTemplate
