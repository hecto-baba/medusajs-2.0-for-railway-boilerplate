"use client"

import { useParams } from "next/navigation"
import React, { useState, useEffect } from "react"
import Input from "@modules/common/components/input"
import AddressSelect from "../address-select"
import CountrySelect from "../country-select"
import { HttpTypes } from "@medusajs/types"
import { Container } from "@medusajs/ui"
import { mapKeys } from "lodash"

/**
 * Every field defaults to "" rather than being left out, so the inputs below
 * are controlled from the first render onwards. Starting from an empty object
 * would hand React `value={undefined}` on mount and make it warn about an
 * uncontrolled input becoming controlled once the address arrives.
 */
const addressToFormData = (
  address?: HttpTypes.StoreCart["billing_address"]
) => ({
  "billing_address.first_name": address?.first_name || "",
  "billing_address.last_name": address?.last_name || "",
  "billing_address.address_1": address?.address_1 || "",
  "billing_address.address_2": address?.address_2 || "",
  "billing_address.company": address?.company || "",
  "billing_address.postal_code": address?.postal_code || "",
  "billing_address.city": address?.city || "",
  "billing_address.country_code": address?.country_code || "",
  "billing_address.province": address?.province || "",
  "billing_address.phone": address?.phone || "",
})

const BillingAddress = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer?: HttpTypes.StoreCustomer | null
}) => {
  // The address on the cart if it has a real one, otherwise the customer's saved
  // billing address, so a returning customer does not retype it.
  const savedBilling = customer?.addresses?.find((a) => a.is_default_billing)
  const params = useParams<{ countryCode?: string }>()

  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial = addressToFormData(
      cart?.billing_address?.address_1
        ? cart.billing_address
        : ((savedBilling as unknown as HttpTypes.StoreCart["billing_address"]) ??
            cart?.billing_address)
    )
    // Start on the store's own country rather than an empty select.
    if (!initial["billing_address.country_code"] && params?.countryCode) {
      initial["billing_address.country_code"] = params.countryCode
    }
    return initial
  })

  useEffect(() => {
    // Only a real address on the cart replaces the form; one without a street
    // would blank out the saved address the form was started with.
    if (cart?.billing_address?.address_1) {
      setFormData(addressToFormData(cart.billing_address))
    }
  }, [cart?.billing_address])

  // Saved addresses in the cart's region, as the shipping form offers them.
  const countriesInRegion = cart?.region?.countries?.map((c) => c.iso_2)
  const addressesInRegion = (customer?.addresses ?? []).filter(
    (a) => a.country_code && countriesInRegion?.includes(a.country_code)
  )

  // The picker supplies an address alone. Only its fields are merged in, so
  // choosing one never clears anything else on the form.
  const selectSavedAddress = (address?: HttpTypes.StoreCartAddress) => {
    if (!address) return
    setFormData((prev) => ({
      ...prev,
      ...addressToFormData(address),
    }))
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <>
      {customer && addressesInRegion.length > 0 && (
        <Container className="mb-6 flex flex-col gap-y-4 p-5">
          <p className="text-small-regular">
            {`Hi ${customer.first_name}, do you want to use one of your saved addresses?`}
          </p>
          {/* Only the address fields are carried into addressInput, so it is
              not a whole StoreCartAddress; matching it against the saved
              addresses is all AddressSelect reads it for. */}
          <AddressSelect
            addresses={customer.addresses}
            addressInput={
              mapKeys(formData, (_, key) =>
                key.replace("billing_address.", "")
              ) as unknown as HttpTypes.StoreCartAddress
            }
            onSelect={selectSavedAddress}
          />
        </Container>
      )}
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
        <Input
          label="Address"
          name="billing_address.address_1"
          autoComplete="address-line1"
          value={formData["billing_address.address_1"]}
          onChange={handleChange}
          required
          data-testid="billing-address-input"
        />
        <Input
          label="Apartment, suite, etc."
          name="billing_address.address_2"
          autoComplete="address-line2"
          value={formData["billing_address.address_2"]}
          onChange={handleChange}
          data-testid="billing-address-2-input"
        />
        <Input
          label="Company"
          name="billing_address.company"
          value={formData["billing_address.company"]}
          onChange={handleChange}
          autoComplete="organization"
          data-testid="billing-company-input"
        />
        <Input
          label="Postal code"
          name="billing_address.postal_code"
          autoComplete="postal-code"
          value={formData["billing_address.postal_code"]}
          onChange={handleChange}
          required
          data-testid="billing-postal-input"
        />
        <Input
          label="City"
          name="billing_address.city"
          autoComplete="address-level2"
          value={formData["billing_address.city"]}
          onChange={handleChange}
          required
          data-testid="billing-city-input"
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
        {/* Optional, for the same reason as the shipping address form. */}
        <Input
          label="State / Province"
          name="billing_address.province"
          autoComplete="address-level1"
          value={formData["billing_address.province"]}
          onChange={handleChange}
          data-testid="billing-province-input"
        />
        <Input
          label="Phone"
          name="billing_address.phone"
          autoComplete="tel"
          value={formData["billing_address.phone"]}
          onChange={handleChange}
          data-testid="billing-phone-input"
        />
      </div>
    </>
  )
}

export default BillingAddress
