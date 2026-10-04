import { defineConfig } from "@playwright/test"

/**
 * Plain unit tests, run with `npm run test:unit`. Unlike the e2e and QA
 * configs there is no browser, server, login or database here: these exercise
 * pure functions only.
 */
export default defineConfig({
  testDir: "./src",
  testMatch: /.*\.unit\.spec\.ts$/,
  fullyParallel: true,
  reporter: "list",
})
