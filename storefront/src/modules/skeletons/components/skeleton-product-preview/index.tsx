const SkeletonProductPreview = () => {
  return (
    <div className="flex animate-pulse flex-col gap-2 rounded-large bg-card p-3 shadow-lift">
      <div className="aspect-[1/0.86] w-full rounded-[12px] bg-canvas" />
      <div className="h-4 w-4/5 rounded-soft bg-canvas" />
      <div className="h-3 w-2/5 rounded-soft bg-canvas" />
      <div className="mt-1 flex items-center justify-between">
        <div className="h-5 w-1/3 rounded-soft bg-canvas" />
        <div className="h-9 w-[76px] rounded-rounded bg-canvas" />
      </div>
    </div>
  )
}

export default SkeletonProductPreview
