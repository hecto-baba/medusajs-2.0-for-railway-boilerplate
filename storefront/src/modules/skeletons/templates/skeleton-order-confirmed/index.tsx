import SkeletonOrderConfirmedHeader from "@modules/skeletons/components/skeleton-order-confirmed-header"
import SkeletonOrderInformation from "@modules/skeletons/components/skeleton-order-information"
import SkeletonOrderItems from "@modules/skeletons/components/skeleton-order-items"

const SkeletonOrderConfirmed = () => {
  return (
    <div className="bg-canvas py-6 min-h-[calc(100vh-64px)] animate-pulse">
      <div className="content-container flex justify-center">
        <div className="max-w-3xl h-full rounded-large bg-card shadow-lift w-full p-6 small:p-10">
          <SkeletonOrderConfirmedHeader />

          <SkeletonOrderItems />

          <SkeletonOrderInformation />
        </div>
      </div>
    </div>
  )
}

export default SkeletonOrderConfirmed
