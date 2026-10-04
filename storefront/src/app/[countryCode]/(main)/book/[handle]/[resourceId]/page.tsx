import { getBusiness } from "@lib/data/appointments"
import Breadcrumbs from "@modules/common/components/breadcrumbs"
import SlotPicker from "@modules/appointments/components/slot-picker"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ countryCode: string; handle: string; resourceId: string }>
  searchParams: Promise<{ service?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode, handle, resourceId } = await params
  const detail = await getBusiness(handle, countryCode)
  const resource = detail?.resources.find((r) => r.id === resourceId)
  return {
    title: resource ? `Book ${resource.name} - ${detail!.business.name}` : "Book an appointment",
  }
}

export default async function BookResourcePage({ params, searchParams }: Props) {
  const { countryCode, handle, resourceId } = await params
  const { service } = await searchParams

  const detail = await getBusiness(handle, countryCode)
  const resource = detail?.resources.find((r) => r.id === resourceId)

  if (!detail || !resource) notFound()

  return (
    <div className="bg-canvas">
      <div className="content-container py-8 small:py-12">
        <Breadcrumbs
          items={[
            { label: "Book", href: "/book" },
            { label: detail.business.name, href: `/book/${detail.business.handle}` },
            { label: resource.name ?? "Booking" },
          ]}
        />

        <SlotPicker
          resource={resource}
          initialProductId={service}
          businessName={detail.business.name}
        />
      </div>
    </div>
  )
}
