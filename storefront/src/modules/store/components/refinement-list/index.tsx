"use client"

import { clx } from "@medusajs/ui"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import SortProducts, { SortOptions } from "./sort-products"

type RefinementListProps = {
  sortBy: SortOptions
  search?: boolean
  "data-testid"?: string
}

const priceInput =
  "h-10 w-24 rounded-rounded border border-line bg-card px-3 text-sm tabular-nums text-ink focus:border-brand focus:outline-none"

/**
 * Sort order and filters for a product listing. Everything is kept in the URL
 * so a filtered page can be shared and the back button works. Changing any of
 * it starts again from the first page.
 */
const RefinementList = ({
  sortBy,
  "data-testid": dataTestId,
}: RefinementListProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onSale = searchParams.get("onSale") === "1"
  const urlMin = searchParams.get("min") ?? ""
  const urlMax = searchParams.get("max") ?? ""
  const [min, setMin] = useState(urlMin)
  const [max, setMax] = useState(urlMax)

  // Keep the boxes in step with the URL (back button, "Clear").
  useEffect(() => {
    setMin(urlMin)
    setMax(urlMax)
  }, [urlMin, urlMax])

  const push = useCallback(
    (change: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams)
      change(params)
      params.delete("page")
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const setQueryParams = (name: string, value: string) =>
    push((params) => params.set(name, value))

  const applyPrice = (event: React.FormEvent) => {
    event.preventDefault()
    push((params) => {
      if (min.trim()) params.set("min", min.trim())
      else params.delete("min")
      if (max.trim()) params.set("max", max.trim())
      else params.delete("max")
    })
  }

  const active = onSale || !!urlMin || !!urlMax

  return (
    <div className="mb-5 flex flex-col gap-4">
      <SortProducts
        sortBy={sortBy}
        setQueryParams={setQueryParams}
        data-testid={dataTestId}
      />

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2"
        data-testid="listing-filters"
      >
        <span className="text-sm font-bold text-muted">Filter</span>
        <button
          type="button"
          aria-pressed={onSale}
          onClick={() =>
            push((params) => {
              if (onSale) params.delete("onSale")
              else params.set("onSale", "1")
            })
          }
          className={clx(
            "rounded-circle border px-3.5 py-1.5 text-sm font-semibold transition-colors",
            onSale
              ? "border-ink bg-ink text-canvas"
              : "border-line bg-card text-ink hover:border-muted"
          )}
          data-testid="filter-on-sale"
        >
          On sale
        </button>

        <form onSubmit={applyPrice} className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="filter-min-price">
            Minimum price
          </label>
          <input
            id="filter-min-price"
            inputMode="decimal"
            placeholder="Min price"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className={priceInput}
            data-testid="filter-min-price"
          />
          <span className="text-muted" aria-hidden="true">
            to
          </span>
          <label className="sr-only" htmlFor="filter-max-price">
            Maximum price
          </label>
          <input
            id="filter-max-price"
            inputMode="decimal"
            placeholder="Max price"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className={priceInput}
            data-testid="filter-max-price"
          />
          <button
            type="submit"
            className="h-10 rounded-rounded border-[1.5px] border-brand bg-card px-4 text-sm font-extrabold text-brand transition-colors hover:bg-brand-soft"
            data-testid="filter-apply-price"
          >
            Apply
          </button>
        </form>

        {active && (
          <button
            type="button"
            onClick={() =>
              push((params) => {
                params.delete("onSale")
                params.delete("min")
                params.delete("max")
              })
            }
            className="text-sm font-bold text-brand hover:underline"
            data-testid="filter-clear"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}

export default RefinementList
