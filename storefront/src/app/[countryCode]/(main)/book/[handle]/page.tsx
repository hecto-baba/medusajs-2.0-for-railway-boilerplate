import { getBusiness } from "@lib/data/appointments"
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
    <div className="content-container py-12" data-testid="business-page">
      <LocalizedClientLink href="/book" className="text-ui-fg-subtle txt-small hover:underline">
        &larr; All businesses
      </LocalizedClientLink>

      <div className="mt-4 mb-8 flex items-center gap-4">
        {business.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.logo} alt="" className="h-16 w-16 rounded-md object-cover" />
        ) : null}
        <h1 className="text-3xl-regular">{business.name}</h1>
      </div>

      {resources.length ? (
        <>
          <p className="text-ui-fg-subtle mb-6">Choose who you&rsquo;d like to book with.</p>
          <ul className="flex flex-col gap-6">
            {resources.map((resource) => (
              <li
                key={resource.id}
                className="border-ui-border-base flex flex-col gap-4 rounded-lg border p-5 small:flex-row"
                data-testid="resource-card"
              >
                {resource.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resource.image_url}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded-md object-cover"
                  />
                ) : null}
                <div className="flex flex-1 flex-col gap-3">
                  <div>
                    <div className="txt-large-plus">{resource.name}</div>
                    {resource.description ? (
                      <p className="text-ui-fg-subtle txt-small">{resource.description}</p>
                    ) : null}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {resource.services.map((service) => (
                      <li
                        key={service.product_id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="txt-medium-plus">{service.title}</div>
                          <div className="text-ui-fg-subtle txt-small">
                            {service.duration_minutes} min
                            {service.capacity > 1 ? ` · group of up to ${service.capacity}` : ""}
                            {service.from_price !== null
                              ? ` · from ${price(service.from_price, service.currency_code)}`
                              : ""}
                          </div>
                        </div>
                        <LocalizedClientLink
                          href={`/book/${business.handle}/${resource.id}?service=${service.product_id}`}
                          className="bg-ui-button-neutral hover:bg-ui-button-neutral-hover rounded-md border px-4 py-2"
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
        <p className="text-ui-fg-subtle py-12">
          {business.name} is not taking online bookings right now.
        </p>
      )}
    </div>
  )
}
