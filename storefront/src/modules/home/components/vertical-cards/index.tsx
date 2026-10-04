import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SectionHeader from "@modules/common/components/section-header"

const CARDS = [
  {
    title: "Restaurants",
    text: "Order food from nearby kitchens",
    href: "/restaurants",
    hue: "#F59E0B",
    testId: "home-vertical-restaurants",
  },
  {
    title: "Book",
    text: "Salons, clinics and services",
    href: "/book",
    hue: "#6CA6E8",
    testId: "home-vertical-book",
  },
  {
    title: "Rent",
    text: "Rent by the hour, day, week or month",
    href: "/rent",
    hue: "#5B9A3C",
    testId: "home-vertical-rent",
  },
  {
    title: "Digital products",
    text: "E-books, software and assets",
    href: "/digital-products",
    hue: "#7A8AF0",
    testId: "home-vertical-digital",
  },
]

/** Entry points to the parts of the store that are not a product shelf. */
const VerticalCards = () => (
  <section data-testid="home-verticals">
    <SectionHeader title="More than shopping" />
    <ul className="grid gap-4 xsmall:grid-cols-2 small:grid-cols-4">
      {CARDS.map((card) => (
        <li key={card.href}>
          <LocalizedClientLink
            href={card.href}
            data-testid={card.testId}
            className="flex h-full min-h-[132px] flex-col justify-between gap-6 rounded-[18px] p-5 shadow-lift transition-transform duration-150 hover:-translate-y-0.5"
            style={{
              background: `color-mix(in srgb, ${card.hue} 16%, rgb(var(--c-card)))`,
            }}
          >
            <span
              className="grid h-10 w-10 place-items-center rounded-[12px] font-display text-lg font-extrabold text-white"
              style={{ background: card.hue }}
              aria-hidden="true"
            >
              {card.title.charAt(0)}
            </span>
            <span>
              <b className="block font-display text-xl font-extrabold">
                {card.title}
              </b>
              <small className="text-muted">{card.text}</small>
            </span>
          </LocalizedClientLink>
        </li>
      ))}
    </ul>
  </section>
)

export default VerticalCards
