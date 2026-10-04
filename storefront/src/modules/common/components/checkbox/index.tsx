import { Checkbox, Label } from "@medusajs/ui"
import React from "react"

type CheckboxProps = {
  checked?: boolean
  onChange?: () => void
  label: string
  name?: string
  'data-testid'?: string
}

const CheckboxWithLabel: React.FC<CheckboxProps> = ({
  checked = true,
  onChange,
  label,
  name,
  'data-testid': dataTestId
}) => {
  return (
    <div className="flex items-center space-x-2 ">
      <Checkbox
        className="text-base-regular flex items-center gap-x-2 !shadow-none border-[1.5px] border-line !bg-card data-[state=checked]:!border-brand data-[state=checked]:!bg-brand data-[state=indeterminate]:!bg-brand text-brand-ink"
        id="checkbox"
        role="checkbox"
        type="button"
        checked={checked}
        aria-checked={checked}
        onClick={onChange}
        name={name}
        data-testid={dataTestId}
      />
      <Label
        htmlFor="checkbox"
        className="!transform-none !txt-medium !text-ink"
        size="large"
      >
        {label}
      </Label>
    </div>
  )
}

export default CheckboxWithLabel
