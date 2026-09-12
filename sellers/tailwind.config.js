/**
 * Deliberately leaner than the storefront's config.
 *
 * The vendor panel is an operator tool, so it inherits the Medusa admin's
 * design tokens through ui-preset and nothing else. The storefront's custom
 * grey scale, breakpoints and keyframes exist for shopper-facing layouts that
 * have no counterpart here.
 */
module.exports = {
  darkMode: "class",
  presets: [require("@medusajs/ui-preset")],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/modules/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@medusajs/ui/dist/**/*.{js,jsx,ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [],
}
