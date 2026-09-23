"use client"

import { Select } from "@medusajs/ui"
import { forwardRef, useMemo } from "react"

export interface CountryOption {
  value: string
  label: string
}

export const COUNTRIES: CountryOption[] = [
  { value: "af", label: "Afghanistan" },
  { value: "al", label: "Albania" },
  { value: "dz", label: "Algeria" },
  { value: "as", label: "American Samoa" },
  { value: "ad", label: "Andorra" },
  { value: "ao", label: "Angola" },
  { value: "ai", label: "Anguilla" },
  { value: "aq", label: "Antarctica" },
  { value: "ag", label: "Antigua and Barbuda" },
  { value: "ar", label: "Argentina" },
  { value: "am", label: "Armenia" },
  { value: "aw", label: "Aruba" },
  { value: "au", label: "Australia" },
  { value: "at", label: "Austria" },
  { value: "az", label: "Azerbaijan" },
  { value: "bs", label: "Bahamas" },
  { value: "bh", label: "Bahrain" },
  { value: "bd", label: "Bangladesh" },
  { value: "bb", label: "Barbados" },
  { value: "by", label: "Belarus" },
  { value: "be", label: "Belgium" },
  { value: "bz", label: "Belize" },
  { value: "bj", label: "Benin" },
  { value: "bm", label: "Bermuda" },
  { value: "bt", label: "Bhutan" },
  { value: "bo", label: "Bolivia" },
  { value: "ba", label: "Bosnia and Herzegovina" },
  { value: "bw", label: "Botswana" },
  { value: "br", label: "Brazil" },
  { value: "bn", label: "Brunei Darussalam" },
  { value: "bg", label: "Bulgaria" },
  { value: "bf", label: "Burkina Faso" },
  { value: "bi", label: "Burundi" },
  { value: "kh", label: "Cambodia" },
  { value: "cm", label: "Cameroon" },
  { value: "ca", label: "Canada" },
  { value: "cv", label: "Cape Verde" },
  { value: "ky", label: "Cayman Islands" },
  { value: "cf", label: "Central African Republic" },
  { value: "td", label: "Chad" },
  { value: "cl", label: "Chile" },
  { value: "cn", label: "China" },
  { value: "co", label: "Colombia" },
  { value: "km", label: "Comoros" },
  { value: "cg", label: "Congo" },
  { value: "cd", label: "Congo, The Democratic Republic of the" },
  { value: "cr", label: "Costa Rica" },
  { value: "ci", label: "Cote D'Ivoire" },
  { value: "hr", label: "Croatia" },
  { value: "cu", label: "Cuba" },
  { value: "cy", label: "Cyprus" },
  { value: "cz", label: "Czech Republic" },
  { value: "dk", label: "Denmark" },
  { value: "dj", label: "Djibouti" },
  { value: "dm", label: "Dominica" },
  { value: "do", label: "Dominican Republic" },
  { value: "ec", label: "Ecuador" },
  { value: "eg", label: "Egypt" },
  { value: "sv", label: "El Salvador" },
  { value: "gq", label: "Equatorial Guinea" },
  { value: "er", label: "Eritrea" },
  { value: "ee", label: "Estonia" },
  { value: "et", label: "Ethiopia" },
  { value: "fj", label: "Fiji" },
  { value: "fi", label: "Finland" },
  { value: "fr", label: "France" },
  { value: "ga", label: "Gabon" },
  { value: "gm", label: "Gambia" },
  { value: "ge", label: "Georgia" },
  { value: "de", label: "Germany" },
  { value: "gh", label: "Ghana" },
  { value: "gr", label: "Greece" },
  { value: "gd", label: "Grenada" },
  { value: "gt", label: "Guatemala" },
  { value: "gn", label: "Guinea" },
  { value: "gw", label: "Guinea-Bissau" },
  { value: "gy", label: "Guyana" },
  { value: "ht", label: "Haiti" },
  { value: "hn", label: "Honduras" },
  { value: "hk", label: "Hong Kong" },
  { value: "hu", label: "Hungary" },
  { value: "is", label: "Iceland" },
  { value: "in", label: "India" },
  { value: "id", label: "Indonesia" },
  { value: "ir", label: "Iran, Islamic Republic of" },
  { value: "iq", label: "Iraq" },
  { value: "ie", label: "Ireland" },
  { value: "il", label: "Israel" },
  { value: "it", label: "Italy" },
  { value: "jm", label: "Jamaica" },
  { value: "jp", label: "Japan" },
  { value: "jo", label: "Jordan" },
  { value: "kz", label: "Kazakhstan" },
  { value: "ke", label: "Kenya" },
  { value: "kr", label: "Korea, Republic of" },
  { value: "kw", label: "Kuwait" },
  { value: "lv", label: "Latvia" },
  { value: "lb", label: "Lebanon" },
  { value: "lt", label: "Lithuania" },
  { value: "lu", label: "Luxembourg" },
  { value: "my", label: "Malaysia" },
  { value: "mv", label: "Maldives" },
  { value: "mx", label: "Mexico" },
  { value: "mc", label: "Monaco" },
  { value: "ma", label: "Morocco" },
  { value: "np", label: "Nepal" },
  { value: "nl", label: "Netherlands" },
  { value: "nz", label: "New Zealand" },
  { value: "ng", label: "Nigeria" },
  { value: "no", label: "Norway" },
  { value: "om", label: "Oman" },
  { value: "pk", label: "Pakistan" },
  { value: "pa", label: "Panama" },
  { value: "ph", label: "Philippines" },
  { value: "pl", label: "Poland" },
  { value: "pt", label: "Portugal" },
  { value: "qa", label: "Qatar" },
  { value: "ro", label: "Romania" },
  { value: "ru", label: "Russian Federation" },
  { value: "sa", label: "Saudi Arabia" },
  { value: "sg", label: "Singapore" },
  { value: "za", label: "South Africa" },
  { value: "es", label: "Spain" },
  { value: "lk", label: "Sri Lanka" },
  { value: "se", label: "Sweden" },
  { value: "ch", label: "Switzerland" },
  { value: "th", label: "Thailand" },
  { value: "tr", label: "Turkey" },
  { value: "ua", label: "Ukraine" },
  { value: "ae", label: "United Arab Emirates" },
  { value: "gb", label: "United Kingdom" },
  { value: "us", label: "United States" },
  { value: "vn", label: "Viet Nam" },
]

export type CountrySelectProps = {
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  placeholder?: string
  name?: string
  autoComplete?: string
}

export const CountrySelect = forwardRef<HTMLButtonElement, CountrySelectProps>(
  (
    {
      value,
      onChange,
      disabled,
      placeholder = "Select a country",
      name,
    },
    ref
  ) => {
    const normalizedValue = useMemo(() => {
      if (!value) return undefined
      const found = COUNTRIES.find(
        (c) => c.value.toLowerCase() === value.toLowerCase()
      )
      return found ? found.value : value.toLowerCase()
    }, [value])

    return (
      <Select
        size="small"
        value={normalizedValue}
        onValueChange={onChange}
        disabled={disabled}
        name={name}
      >
        <Select.Trigger ref={ref}>
          <Select.Value placeholder={placeholder} />
        </Select.Trigger>
        <Select.Content className="max-h-60 overflow-y-auto">
          {COUNTRIES.map((c) => (
            <Select.Item key={c.value} value={c.value}>
              {c.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    )
  }
)

CountrySelect.displayName = "CountrySelect"
