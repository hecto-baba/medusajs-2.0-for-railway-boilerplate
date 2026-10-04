import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { Bricolage_Grotesque, DM_Sans } from "next/font/google"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

// Applies a saved dark-mode choice before first paint so there is no flash.
// Only an explicit choice (stored by the theme toggle) turns dark on. The
// system preference is deliberately not followed yet: pages that are not
// restyled would otherwise render half dark.
const themeScript = `(function(){try{var d=localStorage.getItem("theme")==="dark";var e=document.documentElement;e.classList.toggle("dark",d);e.dataset.mode=d?"dark":"light"}catch(_){}})()`

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-mode="light"
      className={`${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
