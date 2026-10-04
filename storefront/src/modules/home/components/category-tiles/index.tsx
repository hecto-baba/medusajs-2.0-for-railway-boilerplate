import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SectionHeader from "@modules/common/components/section-header"

// Soft hues cycled over the tiles. Each tile mixes its hue into the card
// colour, so the same list works in light and dark.
const HUES = [
  "#5B9A3C",
  "#6CA6E8",
  "#F2B33D",
  "#C98A4B",
  "#E8452C",
  "#6CC6B8",
  "#B9B3E8",
  "#F3A6C0",
  "#F59E0B",
  "#7A8AF0",
]

/**
 * "Shop by category" tiles. Categories have no icon of their own yet, so each
 * tile shows the category's first letter on a coloured square. When category
 * metadata gets an image or icon, render it here instead.
 */
export default async function CategoryTiles() {
  const categories = ((await listCategories().catch(() => [])) ?? [])
    .filter((c) => !c.parent_category_id)
    .slice(0, 10)

  if (!categories.length) {
    return null
  }

  return (
    <section data-testid="home-category-tiles">
      <SectionHeader title="Shop by category" href="/store" linkLabel="All products" />
      <ul className="grid grid-cols-3 gap-3 xsmall:grid-cols-4 small:grid-cols-5 medium:grid-cols-10">
        {categories.map((category, index) => {
          const hue = HUES[index % HUES.length]
          return (
            <li key={category.id}>
              <LocalizedClientLink
                href={`/categories/${category.handle}`}
                className="group grid justify-items-center gap-2 text-center"
                data-testid="home-category-tile"
              >
                <span
                  className="grid aspect-[1/0.92] w-full place-items-center rounded-[18px] font-display text-4xl font-extrabold transition-transform duration-150 group-hover:-translate-y-0.5"
                  style={{
                    background: `color-mix(in srgb, ${hue} 24%, rgb(var(--c-card)))`,
                    color: hue,
                  }}
                  aria-hidden="true"
                >
                  {category.name.charAt(0).toUpperCase()}
                </span>
                <span className="line-clamp-2 text-xs font-semibold leading-tight">
                  {category.name}
                </span>
              </LocalizedClientLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
