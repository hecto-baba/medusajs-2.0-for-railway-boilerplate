import { convertToLocale } from "@lib/util/money"
import Chip from "@modules/common/components/chip"

type DeliveryInfoProps = {
  /** Configured delivery time ("9 mins"), or null when not set. */
  eta: string | null
  /** Order amount above which delivery is free, or null when not set. */
  freeThreshold: number | null
  currencyCode: string
}

/** What the store promises about delivery. Shows only what is configured. */
const DeliveryInfo = ({ eta, freeThreshold, currencyCode }: DeliveryInfoProps) => {
  if (!eta && !freeThreshold) {
    return null
  }

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-2 rounded-large bg-card p-3.5 text-sm shadow-lift"
      data-testid="product-delivery-info"
    >
      {eta && <Chip tone="pop">{`Arrives in ${eta}`}</Chip>}
      {freeThreshold && (
        <span className="text-muted">
          Free delivery on orders above{" "}
          {convertToLocale({ amount: freeThreshold, currency_code: currencyCode })}
        </span>
      )}
    </div>
  )
}

export default DeliveryInfo
