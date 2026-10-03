const { loadEnv } = require("@medusajs/framework/utils")
// Loads .env.test only (never .env), so tests cannot pick up the real DATABASE_URL.
loadEnv("test", process.cwd())

module.exports = {
  transform: {
    "^.+\.[jt]sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true, decorators: true },
          transform: { react: { runtime: "automatic" } },
          target: "es2021",
        },
      },
    ],
  },
  testEnvironment: "node",
  // tsx/jsx: the email templates under src/modules/email-notifications are React.
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json"],
  // Mirrors tsconfig `paths: { "*": ["./src/*"] }` (e.g. imports like "lib/constants").
  modulePaths: ["<rootDir>/src"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  testMatch: ["<rootDir>/integration-tests/**/*.spec.[jt]s"],
  setupFiles: ["./integration-tests/setup.js"],
}
