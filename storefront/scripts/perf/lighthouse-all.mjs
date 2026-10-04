// Runs Lighthouse (mobile, performance only) against every key storefront page
// of a running PRODUCTION build and prints a median table.
//
//   NEXT_DIST_DIR=.next-prod npx next build
//   NEXT_DIST_DIR=.next-prod npx next start -p 8100
//   node scripts/perf/lighthouse-all.mjs            # all pages, 3 runs each
//   RUNS=5 BASE=http://localhost:8100 node scripts/perf/lighthouse-all.mjs
//   PAGES=home,cart node scripts/perf/lighthouse-all.mjs
//   BUDGET=95 ...   exit code 1 when any page's median score is below it
//
// Dev-server scores are meaningless (unminified code, on-demand compiles), so
// always point this at `next start`. Single runs swing 15-20 points; hence
// the median.
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const BASE = process.env.BASE || "http://localhost:8100"
const RUNS = Number(process.env.RUNS || 3)
const BUDGET = process.env.BUDGET ? Number(process.env.BUDGET) : null
const CC = process.env.COUNTRY || "gb"

const ALL = {
  home: `/${CC}`,
  store: `/${CC}/store`,
  product: `/${CC}/products/${process.env.PRODUCT || "sweatpants"}`,
  category: `/${CC}/categories/${process.env.CATEGORY || "sweatshirts"}`,
  cart: `/${CC}/cart`,
  // Checkout redirects to /cart without a cart cookie: set CART_ID to a cart
  // that has items (create one via the Medusa store API) to measure it.
  ...(process.env.CART_ID ? { checkout: `/${CC}/checkout` } : {}),
  login: `/${CC}/account`,
  search: `/${CC}/search`,
  restaurants: `/${CC}/restaurants`,
  book: `/${CC}/book`,
  rent: `/${CC}/rent`,
  digital: `/${CC}/digital-products`,
}
const wanted = process.env.PAGES ? process.env.PAGES.split(",") : Object.keys(ALL)

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const out = path.join(tmpdir(), "lh-all")
mkdirSync(out, { recursive: true })

const rows = []
for (const name of wanted) {
  const url = ALL[name]
  if (!url) continue
  // Warm the route so a cold render does not count against the page.
  await fetch(BASE + url).catch(() => {})
  const runs = []
  for (let i = 0; i < RUNS; i++) {
    const file = path.join(out, `${name}-${i}.json`)
    try {
      execFileSync(
        "npx",
        [
          "-y", "lighthouse", BASE + url,
          "--preset=perf", "--output=json", `--output-path=${file}`,
          "--chrome-flags=--headless=new --no-sandbox", "--quiet",
          // Checkout needs a cart: CART_ID is a cart that already has items.
          ...(name === "checkout" && process.env.CART_ID
            ? [`--extra-headers={\\"Cookie\\":\\"_medusa_cart_id=${process.env.CART_ID}\\"}`]
            : []),
        ],
        { stdio: "ignore", shell: true }
      )
      const r = JSON.parse(readFileSync(file, "utf8"))
      if (r.runtimeError) throw new Error(r.runtimeError.code)
      const a = r.audits
      runs.push({
        score: Math.round(r.categories.performance.score * 100),
        lcp: a["largest-contentful-paint"].numericValue,
        tbt: a["total-blocking-time"].numericValue,
        cls: a["cumulative-layout-shift"].numericValue,
        kb: a["total-byte-weight"].numericValue / 1024,
      })
    } catch {
      /* failed run: skipped, page reported as n/a if none succeed */
    } finally {
      rmSync(file, { force: true })
    }
  }
  rows.push({ name, runs })
}

const pad = (v, n) => String(v).padEnd(n)
console.log(`\nMedian of ${RUNS} runs, mobile, ${BASE}\n`)
console.log(pad("page", 13) + pad("score", 7) + pad("LCP(s)", 8) + pad("TBT(ms)", 9) + pad("CLS", 7) + "KB")
let failed = false
for (const { name, runs } of rows) {
  if (!runs.length) {
    console.log(pad(name, 13) + "n/a (all runs failed)")
    failed = true
    continue
  }
  const m = (k) => median(runs.map((r) => r[k]))
  const score = m("score")
  if (BUDGET !== null && score < BUDGET) failed = true
  console.log(
    pad(name, 13) + pad(score, 7) + pad((m("lcp") / 1000).toFixed(1), 8) +
      pad(Math.round(m("tbt")), 9) + pad(m("cls").toFixed(3), 7) + Math.round(m("kb"))
  )
}
if (BUDGET !== null) console.log(`\nBudget ${BUDGET}: ${failed ? "FAILED" : "passed"}`)
process.exit(failed && BUDGET !== null ? 1 : 0)
