/**
 * Runs the HTTP integration tests against a throwaway LOCAL Postgres.
 *
 * Starts an embedded Postgres 16 on a private port with a temporary data
 * directory, points the Medusa test runner at it through DB_* variables, runs
 * jest, then stops Postgres and deletes the data. It never touches a remote or
 * real database; the process environment set here takes precedence over
 * anything in .env.test.
 *
 * Usage: pnpm run test:integration [-- <jest args>]
 */
const { spawn } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")
const EmbeddedPostgres = require("embedded-postgres").default

const PORT = 54329
const PASSWORD = "postgres"

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

    const jestArgs = process.argv.slice(2)
    const args = [
      "--experimental-vm-modules",
      path.join("node_modules", "jest", "bin", "jest.js"),
      ...(jestArgs.length ? jestArgs : ["integration-tests/http"]),
      "--runInBand",
      "--forceExit",
    ]

    exitCode = await new Promise((resolve) => {
      const child = spawn(process.execPath, args, {
        stdio: "inherit",
        env: {
          ...process.env,
          DB_HOST: "localhost",
          DB_PORT: String(PORT),
          DB_USERNAME: "postgres",
          DB_PASSWORD: PASSWORD,
        },
      })
      child.on("exit", (code) => resolve(code ?? 1))
    })
  } finally {
    try {
      await pg.stop()
    } catch (error) {
      console.error("[tests] failed to stop Postgres cleanly:", error.message)
    }
    fs.rmSync(dataDir, { recursive: true, force: true })
    console.log("[tests] local Postgres stopped and its data removed")
  }

  process.exit(exitCode)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
