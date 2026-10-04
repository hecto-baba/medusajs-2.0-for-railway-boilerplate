"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

import { useCart } from "@lib/context/cart-context"

// The drawer (and everything it pulls in: discount code, quote button,
// suggestions, Headless UI dialog) is only needed once it is first opened.
const CartDrawer = dynamic(() => import("./index"), { ssr: false })

const LazyCartDrawer = () => {
  const { drawerOpen } = useCart()
  const [everOpened, setEverOpened] = useState(false)

  useEffect(() => {
    if (drawerOpen) setEverOpened(true)
  }, [drawerOpen])

  return drawerOpen || everOpened ? <CartDrawer /> : null
}

export default LazyCartDrawer
