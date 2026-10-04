import { getBusiness } from "@lib/data/appointments"
import RemoteImage from "@modules/appointments/components/remote-image"
import Breadcrumbs from "@modules/common/components/breadcrumbs"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ countryCode: string; handle: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode, handle } = await params
  const detail = await getBusiness(handle, countryCode)
  return { title: detail ? `Book with ${detail.business.name}` : "Book an appointment" }
}

const price = (value: number | null, currency: string | null) => {
  if (value === null) return null
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(value)
  } catch {
    return String(value)
  }
}

export default async function BusinessPage({ params }: Props) {
  const { countryCode, handle } = await params
  const detail = await getBusiness(handle, countryCode)

  if (!detail) notFound()

  const { business, resources } = detail

  return (
    <div className="bg-canvas">
    <div className="content-container py-8 small:py-12" data-testid="business-page">
      <Breadcrumbs
        items={[{ label: "Book", href: "/book" }, { label: business.name }]}
      />

      <div className="mb-6 flex items-center gap-4 rounded-large bg-card p-5 shadow-lift">
        {business.logo ? (
          <RemoteImage src={business.logo} width={64} height={64} className="h-16 w-16 rounded-[12px] object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[12px] bg-brand-soft font-display text-2xl font-extrabold text-brand">
            {business.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <h1 className="min-w-0 break-words font-display text-2xl font-extrabold tracking-tight text-ink small:text-3xl">
          {business.name}
        </h1>
      </div>

      {resources.length ? (
        <>
          <p className="mb-4 text-muted">Choose who you&rsquo;d like to book with.</p>
          <ul className="flex flex-col gap-4">
            {resources.map((resource) => (
              <li
                key={resource.id}
                className="flex flex-col gap-4 rounded-large bg-card p-5 shadow-lift small:flex-row"
                data-testid="resource-card"
              >
                {resource.image_url ? (
                  <RemoteImage
                    src={resource.image_url}
                    width={80}
                    height={80}
                    className="h-16 w-16 shrink-0 rounded-[12px] object-cover small:h-20 small:w-20"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[12px] bg-brand-soft font-display text-2xl font-extrabold text-brand small:h-20 small:w-20">
                    {(resource.name ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-3">
                  <div>
                    <div className="font-display text-lg font-extrabold text-ink">{resource.name}</div>
                    {resource.description ? (
                      <p className="text-sm text-muted">{resource.description}</p>
                    ) : null}
                  </div>
                  <ul className="flex flex-col divide-y divide-line">
                    {resource.services.map((service) => (
                      <li
                        key={service.product_id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div>
                          <div className="font-bold text-ink">{service.title}</div>
                          <div className="text-sm text-muted">
                            {service.duration_minutes} min
                            {service.capacity > 1 ? ` · group of up to ${service.capacity}` : ""}
                            {service.from_price !== null
                              ? ` · from ${price(service.from_price, service.currency_code)}`
                              : ""}
                          </div>
                        </div>
                        <LocalizedClientLink
                          href={`/book/${business.handle}/${resource.id}?service=${service.product_id}`}
                          className="shrink-0 rounded-rounded bg-brand px-5 py-2 font-extrabold text-brand-ink hover:opacity-90"
                          data-testid="book-service-link"
                        >
                          Book
                        </LocalizedClientLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="rounded-large bg-card p-8 text-muted shadow-lift">
          {business.name} is not taking online bookings right now.
        </p>
      )}
    </div>
    </div>
  )
}
