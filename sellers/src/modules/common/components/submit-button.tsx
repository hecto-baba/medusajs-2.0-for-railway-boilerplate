"use client"

import { Button } from "@medusajs/ui"
import { useFormStatus } from "react-dom"

/**
 * Submit button that disables and spins while its form action is in flight.
 *
 * Must live in its own component: useFormStatus reports the status of the
 * nearest parent <form>, so calling it in the component that renders the form
 * would always report false.
 */
export const VendorSubmitButton = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant="primary"
      size="large"
      className="w-full"
      isLoading={pending}
    >
      {children}
    </Button>
  )
}
