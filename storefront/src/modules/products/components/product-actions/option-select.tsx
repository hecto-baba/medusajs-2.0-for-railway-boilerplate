import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  /** Small text under a value, for example its price (keyed by value). */
  hints?: Record<string, string>
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
  hints,
}) => {
  const filteredOptions = option.values?.map((v) => v.value)

  return (
    <div className="flex flex-col gap-y-3">
      <span className="text-sm font-bold">Select {title}</span>
      <div
        className="grid grid-cols-2 gap-2.5 xsmall:grid-cols-3"
        data-testid={dataTestId}
      >
        {filteredOptions?.map((v) => {
          const selected = v === current
          return (
            <button
              onClick={() => updateOption(option.title ?? "", v ?? "")}
              key={v}
              className={clx(
                "min-h-[48px] rounded-[14px] border-[1.5px] px-2 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "border-brand bg-brand-soft text-ink"
                  : "border-line bg-card text-ink hover:border-muted"
              )}
              disabled={disabled}
              aria-pressed={selected}
              data-testid="option-button"
            >
              <span className="block">{v}</span>
              {hints?.[v ?? ""] && (
                <span className="mt-0.5 block text-xs font-medium tabular-nums text-muted">
                  {hints[v ?? ""]}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default OptionSelect
