import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  title: {
    default: "Vendor Portal",
    template: "%s | Vendor Portal",
  },
  description: "Manage your store, products and orders.",
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <body className="bg-ui-bg-subtle min-h-screen">
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
