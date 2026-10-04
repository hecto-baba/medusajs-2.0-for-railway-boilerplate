import { getDeliveryEta, getFreeDeliveryThreshold, getStoreName } from "@lib/util/env"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { BoltIcon } from "@modules/common/icons/ui-icons"

/**
 * Home page banner grid: one large banner and two smaller promo tiles.
 *
 * The copy only says things that are true of the store. A delivery time or a
 * free-delivery threshold appears only when the owner has configured one
 * (NEXT_PUBLIC_DELIVERY_ETA, NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD); there are
 * no invented discounts. Replace the text here when real campaigns exist.
 */
const Hero = () => {
  const eta = getDeliveryEta()
  const threshold = getFreeDeliveryThreshold()

  return (
    <section
      className="grid gap-4 small:grid-cols-[2fr_1fr]"
      data-testid="home-hero"
    >
      <div className="relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-[20px] bg-gradient-to-br from-brand to-[#8f2614] p-7 text-white small:min-h-[320px] small:p-9">
        <BoltIcon
          size={260}
          className="pointer-events-none absolute -bottom-10 -right-6 text-white/10"
        />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-90">
            {eta ? `Delivery in ${eta}` : "Welcome"}
          </p>
          <h1
            className="mt-3 max-w-[16ch] font-display text-4xl font-extrabold leading-[1.02] tracking-tight small:text-5xl"
            data-testid="home-hero-title"
          >
            Everything you need from {getStoreName()}
          </h1>
        </div>
        <LocalizedClientLink
          href="/store"
          className="relative mt-6 inline-flex w-fit items-center rounded-circle bg-white px-6 py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90"
          data-testid="home-hero-cta"
        >
          Start shopping
        </LocalizedClientLink>
      </div>

      <div className="grid gap-4">
        <LocalizedClientLink
          href="/restaurants"
          className="relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-[20px] bg-gradient-to-br from-[#2d2468] to-[#5a47c9] p-6 text-white"
        >
          <span>
            <small className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-90">
              Eat
            </small>
            <span className="mt-1 block max-w-[12ch] font-display text-2xl font-extrabold leading-tight">
              Order from nearby kitchens
            </span>
          </span>
          <span className="mt-4 inline-flex w-fit rounded-circle bg-white px-4 py-1.5 text-sm font-bold text-ink">
            See restaurants
          </span>
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/book"
          className="relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0b5a38] to-success p-6 text-white"
        >
          <span>
            <small className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-90">
              {threshold ? "Free delivery" : "Book"}
            </small>
            <span className="mt-1 block max-w-[12ch] font-display text-2xl font-extrabold leading-tight">
              {threshold ? "On bigger orders" : "Appointments, online"}
            </span>
          </span>
          <span className="mt-4 inline-flex w-fit rounded-circle bg-white px-4 py-1.5 text-sm font-bold text-ink">
            {threshold ? "Start adding" : "Find a time"}
          </span>
        </LocalizedClientLink>
      </div>
    </section>
  )
}

export default Hero
