import { listBusinesses } from "@lib/data/appointments"
import RemoteImage from "@modules/appointments/components/remote-image"
import Chip from "@modules/common/components/chip"
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
    <div className="bg-canvas">
    <div className="content-container py-8 small:py-12" data-testid="book-businesses-page">
      <div className="mb-6 rounded-large bg-card p-5 shadow-lift small:p-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink small:text-4xl">
          Book an appointment
        </h1>
        <p className="mt-2 text-muted">
          Choose a business, pick a time that suits you, and book online.
        </p>

      <form method="get" className="mt-5 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search businesses"
          aria-label="Search businesses"
          className="w-full max-w-md rounded-rounded border border-line bg-canvas px-3 py-2.5 text-ink placeholder:text-muted"
        />
        <button
          type="submit"
          className="rounded-rounded bg-brand px-5 py-2.5 font-extrabold text-brand-ink hover:opacity-90"
        >
          Search
        </button>
      </form>
      </div>

      {businesses.length ? (
        <ul className="grid grid-cols-1 gap-4 xsmall:grid-cols-2 medium:grid-cols-3">
          {businesses.map((business) => (
            <li key={business.id}>
              <LocalizedClientLink
                href={`/book/${business.handle}`}
                className="flex h-full flex-col gap-4 rounded-large bg-card p-5 shadow-lift transition-shadow hover:shadow-pop"
                data-testid="business-card"
              >
                {business.logo ? (
                  <RemoteImage
                    src={business.logo}
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-[12px] object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-[12px] bg-brand-soft font-display text-2xl font-extrabold text-brand">
                    {business.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2">
                  <div className="break-words font-display text-lg font-extrabold text-ink">
                    {business.name}
                  </div>
                  <div>
                    <Chip tone="muted">
                      {business.resource_count}{" "}
                      {business.resource_count === 1 ? "person or place" : "people and places"} to book
                    </Chip>
                  </div>
                </div>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-large bg-card py-16 text-center text-muted shadow-lift">
          {q
            ? `No businesses match "${q}".`
            : "No businesses are taking bookings yet. Please check back soon."}
        </div>
      )}

      {pages > 1 ? (
        <div className="mt-10 flex items-center justify-center gap-4">
          {pageNumber > 1 ? (
            <LocalizedClientLink href={href(pageNumber - 1)} className="font-bold text-brand hover:underline">
              Previous
            </LocalizedClientLink>
          ) : null}
          <span className="text-sm text-muted">
            Page {pageNumber} of {pages}
          </span>
          {pageNumber < pages ? (
            <LocalizedClientLink href={href(pageNumber + 1)} className="font-bold text-brand hover:underline">
              Next
            </LocalizedClientLink>
          ) : null}
        </div>
      ) : null}
    </div>
    </div>
  )
}
