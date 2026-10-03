import { listBusinesses } from "@lib/data/appointments"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Book an appointment",
  description: "Find a business and book an appointment online.",
}

const PAGE_SIZE = 12

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page } = await searchParams
  const pageNumber = Math.max(1, Number(page) || 1)

  const { businesses, count } = await listBusinesses({
    q,
    limit: PAGE_SIZE,
    offset: (pageNumber - 1) * PAGE_SIZE,
  })

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const href = (p: number) => `/book?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`

  return (
    <div className="content-container py-12" data-testid="book-businesses-page">
      <h1 className="text-3xl-regular mb-2">Book an appointment</h1>
      <p className="text-ui-fg-subtle mb-6">
        Choose a business, pick a time that suits you, and book online.
      </p>

      <form method="get" className="mb-8 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search businesses"
          aria-label="Search businesses"
          className="border-ui-border-base w-full max-w-md rounded-md border px-3 py-2"
        />
        <button type="submit" className="bg-ui-button-neutral rounded-md border px-4 py-2">
          Search
        </button>
      </form>

      {businesses.length ? (
        <ul className="grid grid-cols-1 gap-6 small:grid-cols-2 medium:grid-cols-3">
          {businesses.map((business) => (
            <li key={business.id}>
              <LocalizedClientLink
                href={`/book/${business.handle}`}
                className="border-ui-border-base hover:shadow-elevation-card-hover flex h-full flex-col gap-3 rounded-lg border p-5 transition-shadow"
                data-testid="business-card"
              >
                {business.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={business.logo}
                    alt=""
                    className="h-16 w-16 rounded-md object-cover"
                  />
                ) : (
                  <div className="bg-ui-bg-subtle flex h-16 w-16 items-center justify-center rounded-md text-2xl">
                    {business.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="txt-large-plus">{business.name}</div>
                  <div className="text-ui-fg-subtle txt-small">
                    {business.resource_count}{" "}
                    {business.resource_count === 1 ? "person or place" : "people and places"} to book
                  </div>
                </div>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-ui-fg-subtle py-16 text-center">
          {q
            ? `No businesses match "${q}".`
            : "No businesses are taking bookings yet. Please check back soon."}
        </div>
      )}

      {pages > 1 ? (
        <div className="mt-10 flex items-center justify-center gap-4">
          {pageNumber > 1 ? (
            <LocalizedClientLink href={href(pageNumber - 1)} className="underline">
              Previous
            </LocalizedClientLink>
          ) : null}
          <span className="text-ui-fg-subtle txt-small">
            Page {pageNumber} of {pages}
          </span>
          {pageNumber < pages ? (
            <LocalizedClientLink href={href(pageNumber + 1)} className="underline">
              Next
            </LocalizedClientLink>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
