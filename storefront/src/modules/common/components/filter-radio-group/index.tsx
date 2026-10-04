import { Label, RadioGroup, clx } from "@medusajs/ui"

type FilterRadioGroupProps = {
  title: string
  items: {
    value: string
    label: string
  }[]
  value: any
  handleChange: (...args: any[]) => void
  "data-testid"?: string
}

/**
 * Single-choice filter shown as a row of pills. Still a real radio group
 * underneath, so it is keyboard and screen reader friendly.
 */
const FilterRadioGroup = ({
  title,
  items,
  value,
  handleChange,
  "data-testid": dataTestId,
}: FilterRadioGroupProps) => {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-sm font-bold text-muted">{title}</span>
      <RadioGroup
        data-testid={dataTestId}
        onValueChange={handleChange}
        className="flex flex-wrap gap-2"
      >
        {items?.map((i) => (
          <div key={i.value}>
            <RadioGroup.Item
              checked={i.value === value}
              className="peer hidden"
              id={i.value}
              value={i.value}
            />
            <Label
              htmlFor={i.value}
              className={clx(
                "!txt-compact-small !transform-none inline-flex cursor-pointer items-center rounded-circle border px-3.5 py-1.5 font-semibold transition-colors",
                i.value === value
                  ? "border-ink bg-ink text-canvas"
                  : "border-line bg-card text-ink hover:border-muted"
              )}
              data-testid="radio-label"
              data-active={i.value === value}
            >
              {i.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}

export default FilterRadioGroup
