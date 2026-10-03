"use client"

import { Toaster, TooltipProvider } from "@medusajs/ui"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { I18nProvider } from "@i18n/provider"
import { installUnauthorizedRedirect } from "@lib/data/unauthorized-redirect"
import { useEffect, useState } from "react"

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

  // An expired session answers 401 from the API proxy: send the seller to /login
  // instead of leaving a page where every action fails.
  useEffect(() => {
    installUnauthorizedRedirect()
  }, [])

  // TooltipProvider is required, not decorative: DataTable's toolbar controls
  // render Radix tooltips, which throw on mount without a provider above them
  // and take the whole page down with a client-side exception.
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
