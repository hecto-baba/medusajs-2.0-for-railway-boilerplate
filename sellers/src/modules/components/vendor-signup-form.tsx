"use client"

import { vendorSignup } from "@lib/data/vendor"
import { Alert, Heading, Hint, Input, Label, Text } from "@medusajs/ui"
import Link from "next/link"
import { useActionState } from "react"
import { VendorSubmitButton } from "./vendor-submit-button"

export const VendorSignupForm = () => {
  const [message, formAction] = useActionState(vendorSignup, null)

  return (
    <div className="w-full max-w-sm flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <Heading level="h1" className="text-ui-fg-base">
          Create your store
        </Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Start selling on the marketplace.
        </Text>
      </div>

      <form action={formAction} className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="name" size="small" weight="plus">
            Store name
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Acme Supply Co."
            aria-required="true"
          />
        </div>

        <div className="grid grid-cols-2 gap-x-3">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="first_name" size="small" weight="plus">
              First name
            </Label>
            <Input
              id="first_name"
              name="first_name"
              type="text"
              autoComplete="given-name"
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="last_name" size="small" weight="plus">
              Last name
            </Label>
            <Input
              id="last_name"
              name="last_name"
              type="text"
              autoComplete="family-name"
            />
          </div>
        </div>

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
          <Hint>
            This email signs you in and cannot also be used for a shopper
            account.
          </Hint>
        </div>

        <div className="flex flex-col gap-y-2">
          <Label htmlFor="password" size="small" weight="plus">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-required="true"
          />
          <Hint>At least 8 characters.</Hint>
        </div>

        {message && (
          <Alert variant="error" className="items-center">
            {message}
          </Alert>
        )}

        <VendorSubmitButton>Create store</VendorSubmitButton>
      </form>

      <Text size="small" className="text-ui-fg-subtle text-center">
        Already selling with us?{" "}
        <Link
          href="/login"
          className="text-ui-fg-base hover:text-ui-fg-subtle underline"
        >
          Sign in
        </Link>
      </Text>
    </div>
  )
}
