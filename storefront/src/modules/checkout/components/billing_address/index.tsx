"use client"

import React, { useState, useEffect } from "react"
import Input from "@modules/common/components/input"
import CountrySelect from "../country-select"
import { HttpTypes } from "@medusajs/types"

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
  "billing_address.company": address?.company || "",
  "billing_address.postal_code": address?.postal_code || "",
  "billing_address.city": address?.city || "",
  "billing_address.country_code": address?.country_code || "",
  "billing_address.province": address?.province || "",
  "billing_address.phone": address?.phone || "",
})

const BillingAddress = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const [formData, setFormData] = useState<Record<string, string>>(() =>
    addressToFormData(cart?.billing_address)
  )

  useEffect(() => {
    setFormData(addressToFormData(cart?.billing_address))
  }, [cart?.billing_address])

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
