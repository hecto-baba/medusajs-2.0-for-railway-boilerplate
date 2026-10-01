/**
 * Runs the HTTP integration tests against a throwaway LOCAL Postgres.
 *
 * Starts an embedded Postgres 16 on a private port with a temporary data
 * directory, points the Medusa test runner at it through DB_* variables, runs
 * jest, then stops Postgres and deletes the data. It never touches a remote or
 * real database; the process environment set here takes precedence over
 * anything in .env.test.
 *
 * Every spec file boots the whole Medusa app, and one long-lived jest process
 * runs out of memory after about fifteen of them. So with no arguments each spec
 * file under integration-tests/http runs in its OWN jest process, one after the
 * other against the same Postgres, and a summary is printed at the end.
 *
 * Usage:
 *   pnpm run test:integration                      every HTTP spec, one process each
 *   pnpm run test:integration -- <path or args>    just that, as one jest run
 */
const { spawn } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")
const EmbeddedPostgres = require("embedded-postgres").default

const PORT = 54329
const PASSWORD = "postgres"
const HTTP_ROOT = path.join("integration-tests", "http")

const collectSpecs = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return collectSpecs(full)
    }
    return /\.spec\.[jt]s$/.test(entry.name) ? [full] : []
  })

const runJest = (jestArgs, env) =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "--experimental-vm-modules",
        path.join("node_modules", "jest", "bin", "jest.js"),
        ...jestArgs,
        "--runInBand",
        "--forceExit",
      ],
      { stdio: "inherit", env }
    )
    child.on("exit", (code) => resolve(code ?? 1))
  })

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "medusa-test-pg-"))

  const pg = new EmbeddedPostgres({
    databaseDir: path.join(dataDir, "data"),
    user: "postgres",
    password: PASSWORD,
    port: PORT,
    persistent: false,
  })

  let exitCode = 1

  try {
    await pg.initialise()
    await pg.start()
    console.log(`[tests] local Postgres started on port ${PORT}`)

    const env = {
      ...process.env,
      DB_HOST: "localhost",
      DB_PORT: String(PORT),
      DB_USERNAME: "postgres",
      DB_PASSWORD: PASSWORD,
    }

    const jestArgs = process.argv.slice(2)

    if (jestArgs.length) {
      exitCode = await runJest(jestArgs, env)
    } else {
      // Jest reads the argument as a pattern, so Windows backslashes must become slashes.
      const specs = collectSpecs(HTTP_ROOT).map((spec) => spec.split(path.sep).join("/")).sort()
      const results = []

      for (const spec of specs) {
        console.log(`\n[tests] ===== ${spec} =====`)
        const code = await runJest([spec], env)
        results.push({ spec, code })
      }

      const failed = results.filter((r) => r.code !== 0)
      console.log("\n[tests] ===== SUMMARY =====")
      for (const { spec, code } of results) {
        console.log(`[tests] ${code === 0 ? "PASS" : "FAIL"} ${spec}`)
      }
      console.log(`[tests] ${results.length - failed.length}/${results.length} spec files passed`)
      exitCode = failed.length ? 1 : 0
    }
  } finally {
    try {
      await pg.stop()
    } catch (error) {
      console.error("[tests] failed to stop Postgres cleanly:", error.message)
    }
    // Windows can hold the data folder for a moment after Postgres stops (EBUSY);
    // retry, and never let cleanup of a temp folder turn a passing run into a failure.
    try {
      fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 })
    } catch (error) {
      console.error(`[tests] could not remove ${dataDir} (harmless, in the temp folder): ${error.code}`)
    }
    console.log("[tests] local Postgres stopped and its data removed")
  }

  process.exit(exitCode)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
