// Fails if any route's First Load JS grows past the budget.
//
//   pnpm check:bundle            builds, then checks
//   pnpm check:bundle --no-build checks the output of a build you just ran
//
// `next build` prints a per-route "First Load JS" table; this reads that table
// rather than the manifests so the number matches what a developer sees.
import { spawnSync } from "node:child_process"

// Largest route today is ~419 kB (/pricing/[id]). The budget leaves headroom for
// normal growth but trips on a regression like a barrel import pulling a whole
// module back into a page, which previously added 100-250 kB per route.
const BUDGET_KB = 450

const skipBuild = process.argv.includes("--no-build")
let output = ""

if (skipBuild) {
  // Reads the build output from stdin: next build | node scripts/check-bundle-size.mjs --no-build
  output = await new Promise((resolve) => {
    let data = ""
    process.stdin.on("data", (c) => (data += c))
    process.stdin.on("end", () => resolve(data))
  })
} else {
  const res = spawnSync("pnpm", ["exec", "next", "build"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  })
  output = `${res.stdout ?? ""}${res.stderr ?? ""}`
  if (res.error) {
    // spawnSync reports "could not start pnpm" here with a null status.
    console.error(`Could not run next build: ${res.error.message}`)
    process.exit(1)
  }
  if (res.status !== 0) {
    console.error(output)
    console.error("next build failed; bundle sizes not checked.")
    process.exit(res.status ?? 1)
  }
}

const rows = []
for (const line of output.split(/\r?\n/)) {
  // e.g. "├ ƒ /products/new   6.01 kB   195 kB"
  const m = line.match(/^[├┌└]\s+\S\s+(\/\S*)\s+[\d.]+\s+[kM]?B\s+([\d.]+)\s+(kB|MB)\s*$/)
  if (m) rows.push({ route: m[1], kb: Number(m[2]) * (m[3] === "MB" ? 1024 : 1) })
}

if (rows.length === 0) {
  console.error("Could not find the route table in the build output; refusing to pass silently.")
  process.exit(1)
}

rows.sort((a, b) => b.kb - a.kb)
const over = rows.filter((r) => r.kb > BUDGET_KB)

console.log(`Checked ${rows.length} routes. Largest: ${rows[0].route} at ${rows[0].kb} kB (budget ${BUDGET_KB} kB).`)

if (over.length > 0) {
  console.error(`\n${over.length} route(s) over the ${BUDGET_KB} kB budget:`)
  for (const r of over) console.error(`  ${r.kb} kB  ${r.route}`)
  console.error("\nRun with ANALYZE=true to see what grew. If the growth is intended, raise BUDGET_KB deliberately.")
  process.exit(1)
}
