import { ResourceDetail } from "@modules/appointments/components/resource-detail"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Resource" }

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <ResourceDetail id={id} />
    </div>
  )
}
