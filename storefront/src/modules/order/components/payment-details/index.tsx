import { Text } from "@medusajs/ui"
import { CreditCard } from "@medusajs/icons"

import { isStripe, paymentInfoMap } from "@lib/constants"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder
}

const PaymentDetails = ({ order }: PaymentDetailsProps) => {
  const payment = order.payment_collections?.[0]?.payments?.[0]
  const isB2BPaid = (order as any).metadata?.payment_status === "paid"
  const b2bPaymentMethod =
    (order as any).metadata?.payment_method || "B2B Instant Payment / Wire Transfer"
  const b2bPaidAt = (order as any).metadata?.paid_at

  const providerInfo = payment?.provider_id ? paymentInfoMap[payment.provider_id] : null

  return (
    <div className="rounded-large bg-card p-5 shadow-lift">
      <h2 className="font-display text-xl font-extrabold tracking-tight mb-4">
        Payment
      </h2>
      <div>
        {payment ? (
          <div className="grid grid-cols-1 gap-4 small:grid-cols-[1fr_2fr] small:gap-x-8 w-full">
            <div className="flex flex-col">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Payment method
              </Text>
              <Text
                className="text-ink"
                data-testid="payment-method"
              >
                {providerInfo?.title || payment.provider_id || "Direct Payment"}
              </Text>
            </div>
            <div className="flex flex-col">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Payment details
              </Text>
              <div className="flex gap-2 text-ink items-center">
                <span className="flex items-center h-7 w-fit rounded-rounded bg-canvas border border-line p-2">
                  {providerInfo?.icon || <CreditCard />}
                </span>
                <Text data-testid="payment-amount">
                  {isStripe(payment.provider_id) && payment.data?.card_last4
                    ? `**** **** **** ${payment.data.card_last4}`
                    : `${convertToLocale({
                        amount: payment.amount,
                        currency_code: order.currency_code,
                      })} paid at ${new Date(
                        payment.created_at ?? ""
                      ).toLocaleString()}`}
                </Text>
              </div>
            </div>
          </div>
        ) : isB2BPaid ? (
          <div className="grid grid-cols-1 gap-4 small:grid-cols-[1fr_2fr] small:gap-x-8 w-full">
            <div className="flex flex-col">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Payment method
              </Text>
              <Text
                className="text-ink"
                data-testid="payment-method"
              >
                {b2bPaymentMethod}
              </Text>
            </div>
            <div className="flex flex-col">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Payment status
              </Text>
              <div className="flex gap-2 text-success font-bold items-center">
                <span className="flex items-center h-7 w-fit rounded-rounded bg-success-soft p-2">
                  <CreditCard className="text-success" />
                </span>
                <Text data-testid="payment-amount">
                  Paid in full
                  {b2bPaidAt && ` on ${new Date(b2bPaidAt).toLocaleString()}`}
                </Text>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-x-2 text-muted text-sm">
            <CreditCard className="w-4 h-4" />
            <span>Payment pending / Invoice on delivery</span>
          </div>
        )}
      </div>

    </div>
  )
}

export default PaymentDetails
