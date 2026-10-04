import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ChevronDown from "@modules/common/icons/chevron-down"
import { BoltIcon } from "@modules/common/icons/ui-icons"
import MedusaCTA from "@modules/layout/components/medusa-cta"
import { getStoreName } from "@lib/util/env"

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative w-full bg-canvas text-ink small:min-h-screen">
      <div className="h-16 border-b border-line bg-card">
        <nav className="content-container flex h-full items-center justify-between">
          <LocalizedClientLink
            href="/cart"
            className="flex flex-1 basis-0 items-center gap-x-2 text-sm font-semibold text-muted hover:text-ink"
            data-testid="back-to-cart-link"
          >
            <ChevronDown className="rotate-90" size={16} />
            <span className="mt-px hidden small:block">Back to shopping cart</span>
            <span className="mt-px block small:hidden">Back</span>
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/"
            className="flex items-center gap-1 font-display text-2xl font-extrabold tracking-tight text-brand"
            data-testid="store-link"
          >
            <BoltIcon
              size={22}
              className="shrink-0 fill-pop stroke-brand"
              strokeWidth={1.5}
            />
            {getStoreName()}
          </LocalizedClientLink>
          <div className="flex-1 basis-0" />
        </nav>
      </div>
      <div className="relative" data-testid="checkout-container">
        {children}
      </div>
      <div className="flex w-full items-center justify-center py-4">
        <MedusaCTA />
      </div>
    </div>
  )
}
