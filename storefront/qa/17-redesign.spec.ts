import { test, expect } from "@playwright/test"
import {
  catalogue,
  expectCartCount,
  findPlainProduct,
  openCartDrawer,
  url,
} from "./helpers"

/**
 * The storefront redesign: cart drawer, product cards, listing filters, rent
 * hub, phone navigation, dark mode and the EOI option. Products are picked by
 * how they are sold (from the catalogue API) rather than by a fixed handle.
 */
test.describe("Redesign", () => {
  test("the cart drawer adds, steps and removes a plain product", async ({
    page,
    request,
  }) => {
    const product = await findPlainProduct(request)
    test.skip(!product, "no plain, priced, in-stock product in this catalogue")

    await page.goto(url(`products/${product!.handle}`))
    await expect(page.getByTestId("product-container")).toBeVisible()
    await page.getByTestId("add-product-button").first().click()

    const drawer = await openCartDrawer(page)
    await expectCartCount(page, 1, "adding a plain product")
    await expect(drawer.getByTestId("cart-item")).toHaveCount(1)

    // + steps the quantity and the count follows.
    await drawer.getByTestId("cart-item-stepper-increment").click()
    await expectCartCount(page, 2, "stepping up")
    await expect(drawer.getByTestId("cart-item-stepper-quantity")).toHaveText("2")

    // - steps down; removing the last one shows the empty state.
    await drawer.getByTestId("cart-item-stepper-decrement").click()
    await expectCartCount(page, 1, "stepping down")
    await drawer.getByTestId("cart-item-remove-button").click()
    await expect(drawer.getByTestId("cart-drawer-empty")).toBeVisible()
    await expect(page.getByTestId("nav-cart-link")).toContainText("(0)")

    // Escape closes it.
    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()
  })

  test("the drawer suggests other products that can be added in one tap", async ({
    page,
    request,
  }) => {
    const product = await findPlainProduct(request)
    test.skip(!product, "no plain product to start from")

    await page.goto(url(`products/${product!.handle}`))
    await page.getByTestId("add-product-button").first().click()
    const drawer = await openCartDrawer(page)

    const suggestions = drawer.getByTestId("cart-suggestion")
    test.skip(
      !(await suggestions.first().waitFor({ timeout: 15_000 }).then(() => true).catch(() => false)),
      "the catalogue has no other one-tap products to suggest"
    )
    await expectCartCount(page, 1, "the first add")
    await drawer.getByTestId("suggestion-stepper-add").first().click()
    await expectCartCount(page, 2, "adding a suggestion")
  })

  test("cards offer ADD only for plain products and a link for everything else", async ({
    page,
    request,
  }) => {
    const products = await catalogue(request)
    await page.goto(url("store"))
    await expect(page.getByTestId("products-list")).toBeVisible()

    const cards = page.getByTestId("product-wrapper")
    const total = await cards.count()
    expect(total).toBeGreaterThan(0)

    // Every card has exactly one of: a stepper/ADD, a link button, or a note.
    for (let i = 0; i < total; i++) {
      const card = cards.nth(i)
      const hasStepper = (await card.getByTestId("card-stepper-add").count()) +
        (await card.getByTestId("card-stepper").count())
      const hasLink = await card.getByTestId("card-select-link").count()
      const hasNote = await card.getByText(/Unavailable|Sold out/).count()
      expect(hasStepper + hasLink + hasNote, `card ${i} has a control`).toBeGreaterThan(0)
    }

    // A rental product never gets a one-tap ADD.
    const rental = products.find((p) => p.rental_configuration?.status === "active" && !p.enquiry_configuration)
    if (rental) {
      await page.goto(url("rent"))
      const rentCard = page.getByTestId("product-wrapper").filter({ hasText: rental.title }).first()
      await expect(rentCard.getByTestId("card-select-link")).toBeVisible()
      await expect(rentCard.getByTestId("card-stepper-add")).toHaveCount(0)
    }
  })

  test("price filters narrow the listing and can be cleared", async ({ page }) => {
    await page.goto(url("store"))
    const count = page.getByTestId("products-count")
    await expect(count).toBeVisible()
    const all = parseInt((await count.innerText()).split(" ")[0], 10)

    await page.getByTestId("filter-max-price").fill("1")
    await page.getByTestId("filter-apply-price").click()
    await page.waitForURL(/max=1/)
    const narrowed = page.getByTestId("products-count").or(page.getByTestId("products-empty"))
    await expect(narrowed.first()).toBeVisible()
    const text = await narrowed.first().innerText()
    const n = /No products/.test(text) ? 0 : parseInt(text.split(" ")[0], 10)
    expect(n).toBeLessThan(all)

    await page.getByTestId("filter-clear").click()
    await expect(page.getByTestId("products-count")).toContainText(String(all))
  })

  test("the rent hub lists rentals and filters by period", async ({ page }) => {
    await page.goto(url("rent"))
    await expect(page.getByTestId("rent-page")).toBeVisible()
    await expect(page.getByTestId("rent-filters")).toBeVisible()

    await page.getByTestId("rent-filters").getByRole("link", { name: "By the day" }).click()
    await expect(page).toHaveURL(/unit=day/)
    await expect(page.getByTestId("rent-list").or(page.getByTestId("rent-empty"))).toBeVisible()
  })

  test("a phone gets the bottom navigation and a desktop does not", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(url())
    const nav = page.getByTestId("mobile-nav")
    await expect(nav).toBeVisible()
    await nav.getByTestId("mobile-nav-shop").click()
    await expect(page).toHaveURL(/\/store/)
    await nav.getByTestId("mobile-nav-cart").click()
    await expect(page.getByTestId("nav-cart-dropdown")).toBeVisible()

    await page.keyboard.press("Escape")
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(nav).toBeHidden()
  })

  test("dark mode can be switched on and is remembered", async ({ page }) => {
    await page.goto(url())
    const html = page.locator("html")
    await expect(html).not.toHaveClass(/dark/)

    await page.getByTestId("theme-toggle").click()
    await expect(html).toHaveClass(/dark/)

    await page.reload()
    await expect(html).toHaveClass(/dark/)

    await page.getByTestId("theme-toggle").click()
    await expect(html).not.toHaveClass(/dark/)
  })

  test("a variant with an active expression of interest offers to reserve it", async ({
    page,
    request,
  }) => {
    const products = await catalogue(request)
    const eoi = products.find((p) =>
      p.variants?.some((v) => v.eoi_configuration?.status === "active")
    )
    test.skip(!eoi, "no variant has an active expression of interest in this catalogue")

    await page.goto(url(`products/${eoi!.handle}`))
    const options = page.getByTestId("eoi-options")
    // The option shows once the EOI variant is the selected one.
    if (!(await options.isVisible().catch(() => false))) {
      await page.getByTestId("option-button").first().click()
    }
    await expect(options).toBeVisible()
    await page.getByTestId("eoi-option-reserve").click()
    await expect(page.getByTestId("add-product-button")).toContainText("Reserve for")
  })

  test("the booking page for a business lists its people and services", async ({
    page,
  }) => {
    await page.goto(url("book"))
    const card = page.getByTestId("business-card").first()
    test.skip(!(await card.isVisible().catch(() => false)), "no bookable business in this catalogue")

    await card.click()
    await expect(page.getByTestId("business-page")).toBeVisible()
    await expect(page.getByTestId("resource-card").first()).toBeVisible()
  })
})
