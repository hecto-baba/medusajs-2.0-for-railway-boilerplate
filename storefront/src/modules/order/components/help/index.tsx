import LocalizedClientLink from "@modules/common/components/localized-client-link"
import React from "react"

const Help = () => {
  return (
    <div className="rounded-large bg-card p-5 shadow-lift">
      <h3 className="font-display text-lg font-extrabold tracking-tight">
        Need help?
      </h3>
      <ul className="my-2 flex flex-col gap-y-2">
        <li>
          <LocalizedClientLink
            href="/contact"
            className="font-bold text-brand hover:underline"
          >
            Contact
          </LocalizedClientLink>
        </li>
        <li>
          <LocalizedClientLink
            href="/contact"
            className="font-bold text-brand hover:underline"
          >
            Returns & Exchanges
          </LocalizedClientLink>
        </li>
      </ul>
    </div>
  )
}

export default Help
