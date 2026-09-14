import { Text, clx } from "@medusajs/ui"
import { ReactNode } from "react"

/**
 * A label/value row inside a settings section. Ported verbatim from the
 * dashboard's components/common/section/section-row so rows line up at the
 * same grid and spacing in both panels.
 */

export type SectionRowProps = {
  title: string
  value?: ReactNode | string | null
  actions?: ReactNode
}

export const SectionRow = ({ title, value, actions }: SectionRowProps) => {
  const isValueString = typeof value === "string" || !value

  return (
    <div
      className={clx(
        `text-ui-fg-subtle grid w-full grid-cols-2 items-center gap-4 px-6 py-4`,
        {
          "grid-cols-[1fr_1fr_28px]": !!actions,
        }
      )}
    >
      <Text size="small" weight="plus" leading="compact">
        {title}
      </Text>

      {isValueString ? (
        <Text
          size="small"
          leading="compact"
          className="whitespace-pre-line text-pretty"
        >
          {value ?? "-"}
        </Text>
      ) : (
        <div className="flex min-w-0 flex-wrap gap-1">{value}</div>
      )}

      {actions && <div>{actions}</div>}
    </div>
  )
}
