import { Metadata } from "next"
import { notFound } from "next/navigation"

import UiShowcase from "@modules/dev/ui-showcase"

export const metadata: Metadata = {
  title: "UI components",
  robots: { index: false, follow: false },
}

// Development aid only. It must never be reachable on a production build.
export default function UiPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return <UiShowcase />
}
