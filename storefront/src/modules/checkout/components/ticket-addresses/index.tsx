"use client"

import { useActionState } from "react"

import { CheckCircleSolid } from "@medusajs/icons"
import { Heading, Text } from "@medusajs/ui"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import Divider from "@modules/common/components/divider"
import Spinner from "@modules/common/icons/spinner"

import { setAddresses } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import BillingAddress from "../billing_address"
import ErrorMessage from "../error-message"
import Input from "@modules/common/components/input"
import { SubmitButton } from "../submit-button"

/**
 * The address step for a cart holding only tickets.
 *
 * Tickets are delivered by email, so this collects a billing address alone
 * rather than the shipping address the standard step asks for. It is a
 * separate component rather than a branch inside that one: the shipping flow
 * carries a "same as billing" toggle and address-book selection that have no
 * meaning here, and threading a mode through all of it would make the common
 * path harder to follow.
 */
const TicketAddresses = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "address"

  const [message, formAction] = useActionState(setAddresses, null)

  const handleEdit = () => {
    router.push(pathname + "?step=address")
  }

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
        >
          Billing Address
          {!isOpen && <CheckCircleSolid />}
        </Heading>
        {!isOpen && cart?.billing_address && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-ticket-address-button"
            >
              Edit
            </button>
          </Text>
        )}
      </div>

      {isOpen ? (
        <form action={formAction}>
          {/* Tells the shared setAddresses action to treat the billing address
              as the only address on this cart. */}
          <input type="hidden" name="tickets_only" value="true" />

          <div className="pb-8">
            <Text className="txt-medium-plus text-ui-fg-subtle mb-6">
              Your tickets are sent by email, so we only need your billing
              details.
            </Text>

            <BillingAddress cart={cart} />

            {/* BillingAddress collects no email, and for tickets the email is
                where the QR codes are actually delivered - so it is asked for
                explicitly here rather than left to the account record. */}
            <div className="mt-4">
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={cart?.email || customer?.email || ""}
                data-testid="ticket-email-input"
              />
              <Text className="txt-small text-ui-fg-subtle mt-2">
                We will send your tickets to this address.
              </Text>
            </div>

            <SubmitButton className="mt-6" data-testid="submit-address-button">
              Continue to payment
            </SubmitButton>
            <ErrorMessage error={message} data-testid="address-error-message" />
          </div>
        </form>
      ) : (
        <div>
          <div className="text-small-regular">
            {cart && cart.billing_address ? (
              <div className="flex items-start gap-x-8">
                <div
                  className="flex flex-col w-1/3"
                  data-testid="ticket-billing-address-summary"
                >
                  <Text className="txt-medium-plus text-ui-fg-base mb-1">
                    Billing Address
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.billing_address.first_name}{" "}
                    {cart.billing_address.last_name}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.billing_address.address_1}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.billing_address.postal_code},{" "}
                    {cart.billing_address.city}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.billing_address.country_code?.toUpperCase()}
                  </Text>
                </div>

                <div
                  className="flex flex-col w-1/3"
                  data-testid="ticket-contact-summary"
                >
                  <Text className="txt-medium-plus text-ui-fg-base mb-1">
                    Contact
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.email}
                  </Text>
                </div>
              </div>
            ) : (
              <Spinner />
            )}
          </div>
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default TicketAddresses
