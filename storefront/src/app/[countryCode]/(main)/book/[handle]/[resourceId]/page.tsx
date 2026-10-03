import { getBusiness } from "@lib/data/appointments"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
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
    <div className="content-container py-12">
      <LocalizedClientLink
        href={`/book/${detail.business.handle}`}
        className="text-ui-fg-subtle txt-small hover:underline"
      >
        &larr; {detail.business.name}
      </LocalizedClientLink>

      <div className="mt-4 mb-8 flex items-center gap-4">
        {resource.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resource.image_url} alt="" className="h-16 w-16 rounded-md object-cover" />
        ) : null}
        <div>
          <h1 className="text-3xl-regular">{resource.name}</h1>
          <p className="text-ui-fg-subtle">{detail.business.name}</p>
        </div>
      </div>

      <SlotPicker resource={resource} initialProductId={service} />
    </div>
  )
}
