import { ShowDetail } from "@modules/shows/components/detail/show-detail"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Show Details" }

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <ShowDetail id={id} />
    </div>
  )
}
