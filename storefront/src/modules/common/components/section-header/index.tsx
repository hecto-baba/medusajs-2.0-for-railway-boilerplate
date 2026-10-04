import React from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

type SectionHeaderProps = {
  title: React.ReactNode
  href?: string
  linkLabel?: string
  className?: string
}

const SectionHeader = ({
  title,
  href,
  linkLabel = "See all",
  className,
}: SectionHeaderProps) => (
  <div
    className={`flex items-baseline justify-between pb-3 pt-8 ${className ?? ""}`}
  >
    <h2 className="font-display text-2xl font-extrabold tracking-tight">
      {title}
    </h2>
    {href && (
      <LocalizedClientLink
        href={href}
        className="text-sm font-bold text-brand hover:underline"
      >
        {linkLabel} ›
      </LocalizedClientLink>
    )}
  </div>
)

export default SectionHeader
