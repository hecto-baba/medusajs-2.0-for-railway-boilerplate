"use client"

import { vendorLogout } from "@lib/data/vendor"
import { Button } from "@medusajs/ui"
import { useFormStatus } from "react-dom"

const LogoutButton = () => {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="secondary" size="small" isLoading={pending}>
      Sign out
    </Button>
  )
}

export const VendorLogoutButton = () => (
  <form action={vendorLogout}>
    <LogoutButton />
  </form>
)
