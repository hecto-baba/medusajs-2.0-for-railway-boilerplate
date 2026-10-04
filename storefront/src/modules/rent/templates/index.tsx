import { HttpTypes } from "@medusajs/types"

import { getProductsList } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import Breadcrumbs from "@modules/common/components/breadcrumbs"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"
import { clx } from "@medusajs/ui"

const UNITS = [
  { value: "", label: "All" },
  { value: "hour", label: "By the hour" },
  { value: "day", label: "By the day" },
  { value: "week", label: "By the week" },
  { value: "month", label: "By the month" },
]

type RentalProduct = HttpTypes.StoreProduct & {
  rental_configuration?: { status?: string; rental_unit?: string } | null
}

/**
 * Everything that can be rented, with a filter for how it is charged.
 *
 * There is no store endpoint that lists rentable products, so this reads the
 * catalogue and keeps the products whose rental configuration is active. That
 * is fine for a catalogue of a few hundred products; a dedicated list route
 * would be the next step for a much larger one.
 */
export default async function RentTemplate({
  countryCode,
  unit,
}: {
  countryCode: string
  unit?: string
}) {
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const {
    response: { products },
  } = await getProductsList({ queryParams: { limit: 100 }, countryCode })

  const rentals = (products as RentalProduct[]).filter(
    (p) =>
      p.rental_configuration?.status === "active" &&
      (!unit || p.rental_configuration?.rental_unit === unit)
  )

  return (
    <div className="content-container py-6" data-testid="rent-page">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Rent" }]} />

      <div className="relative mb-6 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0b4f66] to-[#1f8bb0] p-7 text-white small:p-9">
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight small:text-5xl">
          Rent it. Return it.
        </h1>
        <p className="mt-3 max-w-[52ch] text-sm leading-relaxed opacity-95 small:text-base">
          Rent by the hour, day, week or month. You pay a refundable deposit
          with the rental, and the seller refunds it once the item is back and
          checked.
        </p>
      </div>

      <div
        className="mb-5 flex flex-wrap gap-2"
        role="group"
        aria-label="Rental period"
        data-testid="rent-filters"
      >
        {UNITS.map((u) => {
          const active = (unit ?? "") === u.value
          return (
            <LocalizedClientLink
              key={u.value || "all"}
              href={u.value ? `/rent?unit=${u.value}` : "/rent"}
              aria-current={active ? "true" : undefined}
              className={clx(
                "rounded-circle border px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "border-ink bg-ink text-canvas"
                  : "border-line bg-card text-ink hover:border-muted"
              )}
            >
              {u.label}
            </LocalizedClientLink>
          )
        })}
      </div>

      {rentals.length ? (
        <>
          <p className="mb-4 text-sm text-muted" data-testid="rent-count">
            {rentals.length} {rentals.length === 1 ? "item" : "items"} to rent
          </p>
          <ul
            className="grid grid-cols-2 gap-3 xsmall:grid-cols-3 small:gap-4 medium:grid-cols-4 large:grid-cols-5"
            data-testid="rent-list"
          >
            {rentals.map((product) => (
              <li key={product.id}>
                <ProductPreview product={product} region={region} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div
          className="rounded-large bg-card px-6 py-16 text-center shadow-lift"
          data-testid="rent-empty"
        >
          <p className="font-display text-xl font-extrabold">
            Nothing to rent here yet
          </p>
          <p className="mt-1 text-sm text-muted">
            Try another rental period, or browse everything in the store.
          </p>
        </div>
      )}
    </div>
  )
}
