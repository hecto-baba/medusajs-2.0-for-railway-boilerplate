"use client"

import { vendorLogin } from "@lib/data/vendor"
import { Alert, Heading, Input, Label, Text } from "@medusajs/ui"
import Link from "next/link"
import { useActionState } from "react"
import { VendorSubmitButton } from "./vendor-submit-button"

export const VendorLoginForm = () => {
  const [message, formAction] = useActionState(vendorLogin, null)

  return (
    <div className="w-full max-w-sm flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <Heading level="h1" className="text-ui-fg-base">
          Sign in to your store
        </Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Manage your products and orders.
        </Text>
      </div>

      <form action={formAction} className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="email" size="small" weight="plus">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@yourstore.com"
            aria-required="true"
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label htmlFor="password" size="small" weight="plus">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-required="true"
          />
        </div>

        {message && (
          <Alert variant="error" className="items-center">
            {message}
          </Alert>
        )}

        <VendorSubmitButton>Sign in</VendorSubmitButton>
      </form>

      <Text size="small" className="text-ui-fg-subtle text-center">
        Don&apos;t have a store yet?{" "}
        <Link
          href="/signup"
          className="text-ui-fg-base hover:text-ui-fg-subtle underline"
        >
          Create one
        </Link>
      </Text>
    </div>
  )
}
