import { Container, Heading, Text } from "@medusajs/ui"
import { CreditCard } from "@medusajs/icons"

import { isStripe, paymentInfoMap } from "@lib/constants"
import Divider from "@modules/common/components/divider"
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
    <div>
      <Heading level="h2" className="flex flex-row text-3xl-regular my-6">
        Payment
      </Heading>
      <div>
        {payment ? (
          <div className="flex items-start gap-x-1 w-full">
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Payment method
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method"
              >
                {providerInfo?.title || payment.provider_id || "Direct Payment"}
              </Text>
            </div>
            <div className="flex flex-col w-2/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Payment details
              </Text>
              <div className="flex gap-2 txt-medium text-ui-fg-subtle items-center">
                <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                  {providerInfo?.icon || <CreditCard />}
                </Container>
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
          <div className="flex items-start gap-x-1 w-full">
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Payment method
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method"
              >
                {b2bPaymentMethod}
              </Text>
            </div>
            <div className="flex flex-col w-2/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Payment status
              </Text>
              <div className="flex gap-2 txt-medium text-emerald-700 font-medium items-center">
                <Container className="flex items-center h-7 w-fit p-2 bg-emerald-50 border border-emerald-200">
                  <CreditCard className="text-emerald-600" />
                </Container>
                <Text data-testid="payment-amount">
                  ✓ Paid in full
                  {b2bPaidAt && ` on ${new Date(b2bPaidAt).toLocaleString()}`}
                </Text>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-x-2 text-ui-fg-subtle text-sm">
            <CreditCard className="w-4 h-4" />
            <span>Payment pending / Invoice on delivery</span>
          </div>
        )}
      </div>

      <Divider className="mt-8" />
    </div>
  )
}

export default PaymentDetails
