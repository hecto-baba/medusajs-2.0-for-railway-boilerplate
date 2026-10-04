import repeat from "@lib/util/repeat"
import SkeletonProductPreview from "@modules/skeletons/components/skeleton-product-preview"

const SkeletonRelatedProducts = () => {
  return (
    <div className="product-page-constraint">
      <div className="mb-4 h-8 w-64 animate-pulse rounded-soft bg-card" />
      <ul className="grid flex-1 grid-cols-2 gap-3 xsmall:grid-cols-3 small:gap-4 medium:grid-cols-4 large:grid-cols-5">
        {repeat(5).map((index) => (
          <li key={index}>
            <SkeletonProductPreview />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SkeletonRelatedProducts
