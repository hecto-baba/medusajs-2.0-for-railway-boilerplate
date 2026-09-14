import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: (import.meta as any).env?.VITE_BACKEND_URL || "/",
  debug: (import.meta as any).env?.DEV,
  auth: {
    type: "session",
  },
})

