"use client"

import { TooltipProvider } from "@medusajs/ui"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/**
 * Created in state rather than at module scope: a module-level client is
 * shared across every request on the server, which would leak one vendor's
 * cached data into another's render.
 */
export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  // TooltipProvider is required, not decorative: DataTable's toolbar controls
  // render Radix tooltips, which throw on mount without a provider above them
  // and take the whole page down with a client-side exception.
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  )
}
