"use client"

import { useActionState, useState } from "react"

import { CheckCircleSolid } from "@medusajs/icons"
import { Heading, Text } from "@medusajs/ui"
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation"

import Divider from "@modules/common/components/divider"
import Spinner from "@modules/common/icons/spinner"

import { setAddresses } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import CountrySelect from "../country-select"
import ErrorMessage from "../error-message"
import Input from "@modules/common/components/input"
import { SubmitButton } from "../submit-button"

/**
 * The first step for a cart with nothing to ship: tickets, appointments,
 * digital downloads, expressions of interest and pickup rentals.
 *
 * Those are delivered by email or collected in person, so this asks for contact
 * details only - name, email, optional phone and country - not a street
 * address. It is a separate component rather than a branch inside the standard
 * address step: that one carries a "same as billing" toggle and address-book
 * selection that have no meaning here, and threading a mode through all of it
 * would make the common path harder to follow.
 *
 * The country is kept because Medusa needs one on the cart to work out tax and
 * to send the shopper back to the right store afterwards. It defaults to the
 * store the shopper is already browsing.
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
  const params = useParams<{ countryCode?: string }>()

  const isOpen = searchParams.get("step") === "address"

  const [message, formAction] = useActionState(setAddresses, null)

  // Everything is controlled from the first render. What is already on the cart
  // wins, then the signed-in customer's account, so a returning customer finds
  // the form filled in and a guest finds it empty.
  const billing = cart?.billing_address
  const [formData, setFormData] = useState<Record<string, string>>(() => ({
    "billing_address.first_name":
      billing?.first_name || customer?.first_name || "",
    "billing_address.last_name":
      billing?.last_name || customer?.last_name || "",
    "billing_address.phone": billing?.phone || customer?.phone || "",
    "billing_address.country_code":
      billing?.country_code ||
      params?.countryCode ||
      cart?.region?.countries?.[0]?.iso_2 ||
      "",
    email: cart?.email || customer?.email || "",
  }))

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleEdit = () => {
    router.push(pathname + "?step=address")
  }

  return (
    <div className="rounded-large bg-card p-5 shadow-lift small:p-6">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className="flex flex-row font-display text-2xl font-extrabold tracking-tight gap-x-2 items-baseline"
        >
          Contact details
          {!isOpen && <CheckCircleSolid />}
        </Heading>
        {!isOpen && cart?.billing_address && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-brand hover:underline"
              data-testid="edit-ticket-address-button"
            >
              Edit
            </button>
          </Text>
        )}
      </div>

      {isOpen ? (
        <form action={formAction}>
          {/* Tells the shared setAddresses action that this cart has nothing to
              ship, so the contact details stand as the only address on it. */}
          <input type="hidden" name="tickets_only" value="true" />

          <div className="pb-8">
            <Text className="txt-medium-plus text-ui-fg-subtle mb-6">
              {customer
                ? `Hi ${customer.first_name || "there"}, we've filled this in from your account. `
                : ""}
              Your tickets and booking confirmations are sent by email, so we
              only need your contact details.
            </Text>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First name"
                name="billing_address.first_name"
                autoComplete="given-name"
                value={formData["billing_address.first_name"]}
                onChange={handleChange}
                required
                data-testid="billing-first-name-input"
              />
              <Input
                label="Last name"
                name="billing_address.last_name"
                autoComplete="family-name"
                value={formData["billing_address.last_name"]}
                onChange={handleChange}
                required
                data-testid="billing-last-name-input"
              />
            </div>

            {/* Email is where the QR codes and confirmations are delivered, so
                it is asked for explicitly here rather than left to the
                account record. */}
            <div className="mt-4">
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                data-testid="ticket-email-input"
              />
              <Text className="txt-small text-ui-fg-subtle mt-2">
                We will send your tickets or booking confirmation to this
                address.
              </Text>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <Input
                label="Phone (optional)"
                name="billing_address.phone"
                autoComplete="tel"
                value={formData["billing_address.phone"]}
                onChange={handleChange}
                data-testid="billing-phone-input"
              />
              <CountrySelect
                name="billing_address.country_code"
                autoComplete="country"
                region={cart?.region}
                value={formData["billing_address.country_code"]}
                onChange={handleChange}
                required
                data-testid="billing-country-select"
              />
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
                  className="flex flex-col w-1/2"
                  data-testid="ticket-billing-address-summary"
                >
                  <Text className="txt-medium-plus text-ui-fg-base mb-1">
                    Name
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.billing_address.first_name}{" "}
                    {cart.billing_address.last_name}
                  </Text>
                  {cart.billing_address.phone && (
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.billing_address.phone}
                    </Text>
                  )}
                </div>

                <div
                  className="flex flex-col w-1/2"
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
