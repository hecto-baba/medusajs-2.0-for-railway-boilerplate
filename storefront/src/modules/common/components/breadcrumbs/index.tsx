import React from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Crumb = { label: string; href?: string }

const Breadcrumbs = ({ items }: { items: Crumb[] }) => (
  <nav
    aria-label="Breadcrumb"
    className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted"
    data-testid="breadcrumbs"
  >
    {items.map((item, index) => {
      const last = index === items.length - 1
      return (
        <React.Fragment key={`${item.label}-${index}`}>
          {item.href && !last ? (
            <LocalizedClientLink href={item.href} className="hover:text-ink">
              {item.label}
            </LocalizedClientLink>
          ) : (
            <span
              className={last ? "text-ink" : undefined}
              aria-current={last ? "page" : undefined}
            >
              {item.label}
            </span>
          )}
          {!last && <span aria-hidden="true">›</span>}
        </React.Fragment>
      )
    })}
  </nav>
)

export default Breadcrumbs
