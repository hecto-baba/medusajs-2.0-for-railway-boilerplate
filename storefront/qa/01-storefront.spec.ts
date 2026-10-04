import { test, expect } from "@playwright/test"
import { qaEnv, url } from "./helpers"

test.describe("Storefront shell", () => {
  test("the root path redirects into the configured region", async ({ page }) => {
    await page.goto("/")

    // A region the seed does not cover used to land here anyway, silently
    // priced in euros. The default must be a country an actual region covers.
    await expect(page).toHaveURL(new RegExp(`/${qaEnv.region}(/|$)`))
  })

  /**
   * The cache id is the whole basis of cache invalidation in this storefront.
   * Every tagged read is scoped with it, and when it is missing getCacheDirectives
   * falls back to no-store, which silently turns caching off and brings back the
   * cart-repaint bug. Nothing else would fail loudly, so it is asserted directly
   * rather than left to reappear as flake.
   */
  test("each visitor gets their own cache id", async ({
    page,
    context,
    browser,
  }) => {
    await page.goto(url())

    const cacheCookie = (await context.cookies()).find(
      (cookie) => cookie.name === "_medusa_cache_id"
    )

    expect(
      cacheCookie?.value,
      "middleware must issue a _medusa_cache_id cookie"
    ).toBeTruthy()

    // A second visitor must not share it. If they did, one shopper adding to
    // their cart would purge every shopper's cached cart.
    const other = await browser.newContext()
    try {
      const otherPage = await other.newPage()
      await otherPage.goto(url())

      const otherCookie = (await other.cookies()).find(
        (cookie) => cookie.name === "_medusa_cache_id"
      )

      expect(otherCookie?.value).toBeTruthy()
      expect(otherCookie!.value).not.toEqual(cacheCookie!.value)
    } finally {
      await other.close()
    }
  })

  test("the store name is used, not the template's own name", async ({ page }) => {
    await page.goto(url())

    await expect(page.getByTestId("nav-store-link")).toHaveText(qaEnv.storeName)
    await expect(page).toHaveTitle(new RegExp(qaEnv.storeName, "i"))

    const footer = page.locator("footer")
    await expect(footer.getByRole("link", { name: qaEnv.storeName })).toBeVisible()
    await expect(footer).toContainText(
      `© ${new Date().getFullYear()} ${qaEnv.storeName}. All rights reserved.`
    )
  })

  test("no page still calls the store 'Medusa Store'", async ({ page }) => {
    for (const path of ["", "store", "account", "cart"]) {
      await page.goto(url(path))
      await expect(page.locator("body")).not.toContainText("Medusa Store")
    }
  })

  test("the footer links to collections and categories", async ({ page }) => {
    await page.goto(url())

    const categories = page.getByTestId("footer-categories")
    await expect(categories).toBeVisible()
    await expect(categories.getByTestId("category-link").first()).toBeVisible()
  })

  test("the main navigation reaches the store, account and cart", async ({ page }) => {
    await page.goto(url())

    await page.getByTestId("nav-store-link").click()
    await expect(page).toHaveURL(new RegExp(`/${qaEnv.region}/?$`))

    await page.getByTestId("nav-account-link").click()
    await expect(page).toHaveURL(/\/account/)

    // The header cart button opens the cart drawer. It is still a real link
    // to /cart for a new tab or a no-JavaScript visit.
    await expect(page.getByTestId("nav-cart-link")).toHaveAttribute(
      "href",
      /\/cart$/
    )
    await page.getByTestId("nav-cart-link").click()
    await expect(page.getByTestId("nav-cart-dropdown")).toBeVisible()
  })

  test("the hero greets shoppers and leads into the store", async ({ page }) => {
    await page.goto(url())

    const title = page.getByTestId("home-hero-title")
    await expect(title).toBeVisible()
    await expect(title).toContainText(qaEnv.storeName)

    // A storefront homepage should have exactly one h1.
    await expect(page.locator("h1")).toHaveCount(1)

    await page.getByTestId("home-hero-cta").click()
    await expect(page).toHaveURL(new RegExp(`/${qaEnv.region}/store`))
    await expect(page.getByTestId("store-page-title")).toBeVisible()
  })

  test("the homepage links to the other parts of the store", async ({ page }) => {
    await page.goto(url())

    await expect(page.getByTestId("home-verticals")).toBeVisible()
    await page.getByTestId("home-vertical-book").click()
    await expect(page).toHaveURL(/\/book/)
  })

  test("a category tile leads to that category", async ({ page }) => {
    await page.goto(url())

    const tile = page.getByTestId("home-category-tile").first()
    await expect(tile).toBeVisible()
    await tile.click()
    await expect(page).toHaveURL(/\/categories\//)
    await expect(page.getByTestId("category-page-title")).toBeVisible()
  })

  test("the homepage does not advertise how it was deployed", async ({ page }) => {
    await page.goto(url())

    // Shoppers should not be told which host the store runs on, and the
    // storefront should not narrate its own deployment.
    const body = await page.locator("body").innerText()
    expect(body).not.toMatch(/railway/i)
    expect(body).not.toMatch(/successfully deployed/i)
  })

  test("the homepage shows products even with no collections", async ({ page }) => {
    await page.goto(url())

    // The featured section is collection-driven and the seed creates none, so
    // without a fallback the page below the hero is blank.
    const rail = page
      .getByTestId("latest-products")
      .or(page.getByTestId("products-list"))
    await expect(rail.first()).toBeVisible()
    await expect(page.getByTestId("product-wrapper").first()).toBeVisible()
  })

  test("the search link is shown when search is enabled", async ({ page }) => {
    test.skip(!qaEnv.searchEnabled, "search feature flag is off")

    await page.goto(url())
    await expect(page.getByTestId("nav-search-link")).toBeVisible()
  })
})
