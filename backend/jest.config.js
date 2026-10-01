const { loadEnv } = require("@medusajs/framework/utils")
// Loads .env.test only (never .env), so tests cannot pick up the real DATABASE_URL.
loadEnv("test", process.cwd())

module.exports = {
  transform: {
    "^.+\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          target: "es2021",
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  // Mirrors tsconfig `paths: { "*": ["./src/*"] }` (e.g. imports like "lib/constants").
  modulePaths: ["<rootDir>/src"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  testMatch: ["<rootDir>/integration-tests/**/*.spec.[jt]s"],
  setupFiles: ["./integration-tests/setup.js"],
}
