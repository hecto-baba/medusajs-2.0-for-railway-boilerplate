import { APIRequestContext, expect, Page } from "@playwright/test"
import { qaEnv } from "./env"

/** Every storefront route is prefixed with a country code. */
export const url = (path = ""): string => {
  const suffix = path.replace(/^\//, "")
  return suffix ? `/${qaEnv.region}/${suffix}` : `/${qaEnv.region}`
}

/**
 * Accounts cannot be deleted from the storefront, so each run registers a
 * fresh address instead of reusing one. Keeping the run id in the local part
 * makes leftovers from a QA run easy to spot in the admin.
 */
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
let sequence = 0

export const uniqueEmail = (prefix = "qa"): string =>
  `${prefix}-${runId}-${sequence++}@example.com`

export type TestCustomer = {
  firstName: string
  lastName: string
  email: string
  password: string
}

export const newCustomer = (prefix = "qa"): TestCustomer => ({
  firstName: "Quinn",
  lastName: "Tester",
  email: uniqueEmail(prefix),
  password: "supersecret",
})

/**
 * Signed-in check that works at any viewport. The account overview body is
 * entirely `hidden small:block`, so on a phone nothing of it renders and the
 * welcome message cannot be waited on. AccountNav is only rendered when a
 * customer is resolved, so the login form being gone is the reliable signal.
 */
export const assertSignedIn = async (page: Page) => {
  await expect(page.getByTestId("login-page")).toHaveCount(0)

  // AccountNav renders only once a customer has actually been resolved, and
  // it emits both navs at every width with CSS deciding which one shows. So
  // "attached" is the viewport-independent proof that we are signed in, and
  // unlike the layout wrapper it is not also present on the login view.
  await expect(page.getByTestId("mobile-account-nav")).toBeAttached()
}

/** Registers a customer through the UI and lands on the account dashboard. */
export const register = async (page: Page, customer: TestCustomer) => {
  await page.goto(url("account"))
  await page.getByTestId("register-button").click()
  await expect(page.getByTestId("register-page")).toBeVisible()

  await page.getByTestId("first-name-input").fill(customer.firstName)
  await page.getByTestId("last-name-input").fill(customer.lastName)
  await page.getByTestId("email-input").fill(customer.email)
  await page.getByTestId("password-input").fill(customer.password)
  await page.getByTestId("register-button").click()

  await assertSignedIn(page)
}

export const login = async (page: Page, customer: TestCustomer) => {
  await page.goto(url("account"))
  await expect(page.getByTestId("login-page")).toBeVisible()
  await page.getByTestId("email-input").fill(customer.email)
  await page.getByTestId("password-input").fill(customer.password)
  await page.getByTestId("sign-in-button").click()
  await assertSignedIn(page)
}

/**
 * Picks the first choice in every option group, which is enough to resolve a
 * variant on all four seeded products.
 */
export const selectFirstVariant = async (page: Page) => {
  // The mobile action bar is position-fixed and can sit over the options.
  await page.mouse.move(0, 0)

  // The mobile sheet renders the same option groups with the same testid, and
  // whether it is mounted depends on scroll position and build mode. Only the
  // groups actually on screen belong to the in-page selector.
  const groups = page.getByTestId("product-options")
  const count = await groups.count()
  for (let i = 0; i < count; i++) {
    const group = groups.nth(i)
    if (await group.isVisible()) {
      await group.getByTestId("option-button").first().click()
    }
  }
}

/** Opens a product by handle, resolves a variant and adds one to the cart. */
export const addProductToCart = async (page: Page, handle: string) => {
  // A handle that could be bought when a test was written can later become a
  // rental or an enquiry-only product, which has no Add to cart button. Fall
  // back to a product that can be bought so the test keeps checking what it is
  // really about (the cart, the checkout) rather than the catalogue.
  handle = await purchasableHandle(page.request, handle).catch(() => handle)

  await page.goto(url(`products/${handle}`))
  await expect(page.getByTestId("product-container")).toBeVisible()

  const countBefore = await cartCount(page)

  await selectFirstVariant(page)

  const addButton = page.getByTestId("add-product-button").first()
  await expect(addButton).toBeEnabled()
  await addButton.click()

  // The cart drawer opens straight away with an "Adding to your cart" row and
  // the count rises at once, while the backend is still saving. Wait for the
  // save to finish before moving on, or the next page load would see an empty
  // cart (and navigating away mid-save can drop the add).
  await expect(page.getByTestId("cart-drawer-adding")).toHaveCount(0, {
    timeout: 120_000,
  })

  // The nav count is the deterministic signal. The dropdown auto-opens only
  // when totalItems differs from a useRef captured at mount, so if the
  // component remounts with the new count already in place it never opens.
  // That happens in production builds but rarely in dev, so asserting on the
  // dropdown here made most of the suite fail against `next start`.
  await expectCartCount(page, countBefore + 1, `adding ${handle}`)
}

/**
 * The cart drawer. Adding from a product page opens it by itself, so right
 * after an add it is usually already open (and covers the header cart button);
 * on a fresh page it has to be opened with a click. Handles both.
 */
export const openCartDrawer = async (page: Page) => {
  const drawer = page.getByTestId("nav-cart-dropdown")
  const open = await drawer
    .waitFor({ state: "visible", timeout: 4_000 })
    .then(() => true)
    .catch(() => false)

  if (!open) {
    await page.getByTestId("nav-cart-link").click()
  }

  await expect(drawer).toBeVisible()
  return drawer
}

/**
 * Waits for the nav cart count, reloading once if it does not repaint.
 *
 * Roughly one add in fifteen never repaints the nav in a production build.
 * Measured, not guessed: on every stuck run the line item IS on the cart in
 * Medusa, the server returns the correct count when the same page is requested
 * with that cart cookie, and a reload recovers it within 250ms. The write
 * lands; the render lags.
 *
 * So this reloads rather than failing. The tests that merely need a populated
 * cart should not go red over a rendering defect, and that defect is held open
 * by its own test, "the cart count repaints without a reload" in
 * qa/04-cart.spec.ts, which carries the full evidence.
 */
export const expectCartCount = async (
  page: Page,
  expected: number,
  context: string
) => expectAfterCartWrite(page, () => cartCount(page), expected, context)

/**
 * Polls for a value the page should show after a cart write, reloading once if
 * it does not appear.
 *
 * Every cart mutation is affected, not just adding: quantity changes and line
 * removals go stale the same way and at the same rate. Count the
 * "did not repaint" warnings in a run to measure it. When the scoped cache tags
 * land, that count should go to zero, which is a far better instrument than one
 * randomly red test per run.
 */
export const expectAfterCartWrite = async <T>(
  page: Page,
  read: () => Promise<T>,
  expected: T,
  context: string
) => {
  try {
    await expect.poll(read, { timeout: 15_000 }).toEqual(expected)
  } catch {
    console.warn(
      `[qa] page did not repaint after ${context}; reloading. ` +
        `See "the cart count repaints without a reload" in qa/04-cart.spec.ts.`
    )
    await page.reload()
    await expect.poll(read, { timeout: 15_000 }).toEqual(expected)
  }
}

/** Reads the item count out of the nav cart link, e.g. "Cart (2)" -> 2. */
export const cartCount = async (page: Page): Promise<number> => {
  const text = await page.getByTestId("nav-cart-link").first().textContent()
  const match = text?.match(/\((\d+)\)/)
  return match ? Number(match[1]) : 0
}

/** Reads a money string like "£19.50" into 19.5 so totals can be compared. */
export const parseMoney = (value: string | null): number => {
  if (!value) {
    return NaN
  }
  const cleaned = value.replace(/[^0-9.,-]/g, "").replace(/,/g, "")
  return Number.parseFloat(cleaned)
}

export { qaEnv }

/**
 * Catalogue facts read straight from the backend, so tests can pick a product
 * by how it is sold instead of hard-coding a handle. A handle that is a plain
 * product today can become a rental or an enquiry-only product tomorrow.
 */
/**
 * Playwright's request client resolves "localhost" to IPv6 first, and a local
 * backend often listens on IPv4 only, so API calls from the tests use the IPv4
 * loopback address. The browser and the storefront server are unaffected.
 */
const apiBase = qaEnv.backendURL.replace("//localhost", "//127.0.0.1")

export type CatalogueProduct = {
  id: string
  handle: string
  title: string
  thumbnail: string | null
  variants: {
    id: string
    manage_inventory?: boolean
    allow_backorder?: boolean
    inventory_quantity?: number
    calculated_price?: { calculated_amount?: number; original_amount?: number }
    eoi_configuration?: { status?: string } | null
    digital_product?: unknown
  }[]
  rental_configuration?: { status?: string } | null
  enquiry_configuration?: { status?: string } | null
  metadata?: Record<string, unknown> | null
}

export const catalogue = async (
  request: APIRequestContext
): Promise<CatalogueProduct[]> => {
  const headers = { "x-publishable-api-key": qaEnv.publishableKey }
  const regions = await (
    await request.get(`${apiBase}/store/regions`, { headers })
  ).json()
  const regionId = regions.regions?.[0]?.id
  const res = await request.get(
    `${apiBase}/store/products?limit=200&region_id=${regionId}&fields=id,handle,title,thumbnail,metadata,*variants.calculated_price,+variants.inventory_quantity,+variants.digital_product.id,+variants.eoi_configuration.*,+rental_configuration.*,+enquiry_configuration.*`,
    { headers }
  )
  return (await res.json()).products ?? []
}

/** A product with one priced, in-stock option that is sold the ordinary way. */
export const isPlainProduct = (p: CatalogueProduct, appointmentIds: Set<string>) => {
  const v = p.variants?.[0]
  const price = v?.calculated_price?.calculated_amount
  const inStock =
    !v?.manage_inventory || v?.allow_backorder || (v?.inventory_quantity ?? 0) > 0
  return (
    p.variants?.length === 1 &&
    !!price &&
    price > 0 &&
    inStock &&
    p.rental_configuration?.status !== "active" &&
    p.enquiry_configuration?.status !== "active" &&
    !v?.digital_product &&
    !appointmentIds.has(p.id) &&
    p.metadata?.dietary_type === undefined &&
    p.metadata?.is_veg === undefined
  )
}

export const appointmentProductIds = async (
  request: APIRequestContext
): Promise<Set<string>> => {
  const headers = { "x-publishable-api-key": qaEnv.publishableKey }
  const ids = new Set<string>()
  try {
    const list = await (
      await request.get(`${apiBase}/store/appointments/businesses?limit=50`, { headers })
    ).json()
    for (const b of list.businesses ?? []) {
      const d = await (
        await request.get(
          `${apiBase}/store/appointments/businesses/${b.handle}?currency_code=eur`,
          { headers }
        )
      ).json()
      for (const r of d.resources ?? []) for (const s of r.services ?? []) ids.add(s.product_id)
    }
  } catch {
    // none known
  }
  return ids
}

export const findPlainProduct = async (request: APIRequestContext) => {
  const [products, appointments] = await Promise.all([
    catalogue(request),
    appointmentProductIds(request),
  ])
  return products.find((p) => !!p.thumbnail && isPlainProduct(p, appointments)) ??
    products.find((p) => isPlainProduct(p, appointments))
}

/**
 * The requested handle if that product can be added to a cart as it is,
 * otherwise a product that can (a single-option one if there is one).
 */
export const purchasableHandle = async (
  request: APIRequestContext,
  wanted: string,
  options: { multiVariant?: boolean } = {}
): Promise<string> => {
  const [products, appointments] = await Promise.all([
    catalogue(request),
    appointmentProductIds(request),
  ])

  const addable = (p: CatalogueProduct) => {
    const priced = p.variants?.some(
      (v) =>
        (v.calculated_price?.calculated_amount ?? 0) > 0 &&
        (!v.manage_inventory || v.allow_backorder || (v.inventory_quantity ?? 0) > 0)
    )
    return (
      !!priced &&
      p.rental_configuration?.status !== "active" &&
      p.enquiry_configuration?.status !== "active" &&
      !appointments.has(p.id) &&
      !p.variants?.some((v) => v.digital_product) &&
      p.metadata?.dietary_type === undefined &&
      p.metadata?.is_veg === undefined
    )
  }

  const requested = products.find((p) => p.handle === wanted)
  if (
    requested &&
    addable(requested) &&
    (!options.multiVariant || requested.variants.length > 1)
  ) {
    return wanted
  }

  if (options.multiVariant) {
    const several = products.find((p) => addable(p) && p.variants.length > 1)
    if (several) return several.handle
  }

  const fallback =
    products.find((p) => !!p.thumbnail && isPlainProduct(p, appointments)) ??
    products.find(addable)
  return fallback?.handle ?? wanted
}
