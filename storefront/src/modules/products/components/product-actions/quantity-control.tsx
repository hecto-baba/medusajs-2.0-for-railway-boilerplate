"use client"

type QuantityControlProps = {
  quantity: number
  setQuantity: (update: (current: number) => number) => void
  disabled?: boolean
}

/** "- n +" quantity picker for the product page. */
const QuantityControl = ({ quantity, setQuantity, disabled }: QuantityControlProps) => (
  <div className="my-1 flex items-center justify-between gap-x-3">
    <span className="text-sm font-bold">Quantity</span>
    <div className="flex items-center overflow-hidden rounded-rounded bg-brand text-brand-ink">
      <button
        type="button"
        disabled={quantity <= 1 || disabled}
        onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
        className="flex h-10 w-10 select-none items-center justify-center text-lg font-extrabold transition-opacity disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        min="1"
        value={quantity}
        disabled={disabled}
        onChange={(e) => {
          const next = Math.max(1, parseInt(e.target.value) || 1)
          setQuantity(() => next)
        }}
        className="h-10 w-14 bg-transparent text-center text-sm font-extrabold tabular-nums text-brand-ink focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label="Quantity"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setQuantity((prev) => prev + 1)}
        className="flex h-10 w-10 select-none items-center justify-center text-lg font-extrabold transition-opacity disabled:opacity-40"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  </div>
)

export default QuantityControl
