import { Metadata } from "next"

import { retrieveCart } from "@lib/data/cart"
import { CartProvider } from "@lib/context/cart-context"
import { getBaseURL } from "@lib/util/env"
import CartDrawer from "@modules/layout/components/cart-drawer/lazy"
import MobileNav from "@modules/layout/components/mobile-nav"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const cart = await retrieveCart()

  return (
    <CartProvider cart={cart}>
      <Nav countryCode={countryCode} />
      {props.children}
      <Footer />
      <CartDrawer />
      <MobileNav />
    </CartProvider>
  )
}
