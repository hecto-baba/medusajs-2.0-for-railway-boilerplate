import fs from "fs"
import path from "path"

/**
 * Ratchet check for seller (/vendors) routes - needs no database.
 *
 * Isolation is enforced per handler, so a forgotten ownership check fails
 * OPEN. This test makes that visible: every route that takes an id in its
 * path must call an ownership guard (assertOwnership, assertVendorOwns*,
 * getOwnedIds, getVendor*Ids), or be listed below.
 *
 *  - REVIEWED_SAFE: scoped some other way; each entry says how.
 *  - BACKLOG: known unguarded routes from the isolation audit. The list may
 *    only SHRINK. A route fixed in Phase 1 must be removed from it (the test
 *    fails until it is), and a NEW unguarded route fails the test outright.
 *
 * Limits: this is a static heuristic. It proves a guard is CALLED, not that it
 * is correct or that body ids are validated. The cross-seller HTTP tests in
 * ../http/vendor-isolation are the real proof.
 * See docs/tenant-isolation-and-multi-tenancy.md.
 */

const ROUTES_ROOT = path.join(process.cwd(), "src", "api", "vendors")

const GUARD_CALL =
  /\b(assert[A-Z][A-Za-z]*|getOwnedIds|getVendor[A-Za-z]*Ids)\s*\(/

const REVIEWED_SAFE: Record<string, string> = {
  "currencies/[code]/route.ts":
    "reads and writes only the calling vendor's own metadata.currencies key",
  "team/invites/[id]/route.ts":
    "SQL is constrained to metadata->>'vendor_id' of the calling vendor",
  "categories/[id]/route.ts":
    "shared taxonomy by design; its write handlers are 403 stubs",
}

const BACKLOG: string[] = [
  "api-keys/[id]/revoke/route.ts",
  "api-keys/[id]/route.ts",
  "categories/[id]/products/route.ts",
  "collections/[id]/products/route.ts",
  "collections/[id]/route.ts",
  "draft-orders/[id]/convert/route.ts",
  "draft-orders/[id]/route.ts",
  "layouts/[zone]/configuration/route.ts",
  "product-options/[id]/route.ts",
  "product-tags/[id]/route.ts",
  "product-types/[id]/route.ts",
  "products/import/[transaction_id]/confirm/route.ts",
  "products/imports/[transaction_id]/confirm/route.ts",
  "sales-channels/[id]/products/route.ts",
  "sales-channels/[id]/route.ts",
  "shipping-option-types/[id]/route.ts",
  "shipping-profiles/[id]/route.ts",
  "stock-locations/[id]/route.ts",
  "tax-regions/[id]/route.ts",
  "team/[id]/route.ts",
  "workflow-executions/[id]/route.ts",
]

// Routes that query a whole entity table with no filter. Must only shrink.
const UNFILTERED_QUERY_BACKLOG: string[] = ["search/route.ts"]

const collectRoutes = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return collectRoutes(full)
    }
    return entry.name === "route.ts" ? [full] : []
  })

const rel = (file: string) =>
  path.relative(ROUTES_ROOT, file).split(path.sep).join("/")

const routes = collectRoutes(ROUTES_ROOT).map((file) => ({
  rel: rel(file),
  source: fs.readFileSync(file, "utf8"),
}))

describe("seller route guards (static ratchet)", () => {
  it("finds the seller routes", () => {
    expect(routes.length).toBeGreaterThan(50)
  })

  it("every route with an id in its path calls an ownership guard, or is listed", () => {
    const unguarded = routes
      .filter((r) => r.rel.includes("[") && !GUARD_CALL.test(r.source))
      .map((r) => r.rel)
      .filter((r) => !(r in REVIEWED_SAFE))
      .sort()

    const unexpected = unguarded.filter((r) => !BACKLOG.includes(r))
    const nowFixed = BACKLOG.filter((r) => !unguarded.includes(r))

    expect({
      "NEW unguarded routes (add an ownership check)": unexpected,
      "FIXED routes (remove from BACKLOG)": nowFixed,
    }).toEqual({
      "NEW unguarded routes (add an ownership check)": [],
      "FIXED routes (remove from BACKLOG)": [],
    })
  })

  it("no route queries a whole entity with an empty filter, or is listed", () => {
    const unfiltered = routes
      .filter((r) => /filters:\s*\{\s*\}/.test(r.source))
      .map((r) => r.rel)
      .sort()

    expect({
      added: unfiltered.filter((r) => !UNFILTERED_QUERY_BACKLOG.includes(r)),
      fixed: UNFILTERED_QUERY_BACKLOG.filter((r) => !unfiltered.includes(r)),
    }).toEqual({ added: [], fixed: [] })
  })
})

/**
 * Safety: the test login can be a database superuser, and the Medusa test
 * runner drops schemas and databases it owns. It is safe only because it
 * generates a random throwaway database name. No test may choose its own name,
 * which could point it at a real database.
 */
describe("integration test safety", () => {
  const collectSpecs = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return collectSpecs(full)
      }
      return /\.(spec|test)\.[jt]s$/.test(entry.name) ? [full] : []
    })

  it("no test passes dbName or DB_TEMP_NAME to the test runner", () => {
    const offenders = collectSpecs(path.join(process.cwd(), "integration-tests"))
      .filter((file) => !file.endsWith("vendor-route-guards.spec.ts"))
      .filter((file) => /\bdbName\s*:|DB_TEMP_NAME/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file))

    expect(offenders).toEqual([])
  })
})
