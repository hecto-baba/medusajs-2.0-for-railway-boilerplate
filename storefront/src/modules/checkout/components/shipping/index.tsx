"use client"

import { RadioGroup } from "@headlessui/react"
import { CheckCircleSolid } from "@medusajs/icons"
import { Button, Heading, Text, clx } from "@medusajs/ui"

import Divider from "@modules/common/components/divider"
import Radio from "@modules/common/components/radio"
import ErrorMessage from "@modules/checkout/components/error-message"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { setShippingMethod } from "@lib/data/cart"
import type { CartShippingGroup } from "@lib/data/fulfillment"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type ShippingProps = {
  cart: HttpTypes.StoreCart
  shippingGroups: CartShippingGroup[] | null
}

const groupTitle = (group: CartShippingGroup, count: number) =>
  count > 1 ? group.vendor?.name ?? "Other items" : null

const Shipping: React.FC<ShippingProps> = ({ cart, shippingGroups }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "delivery"

  const groups = shippingGroups ?? []

  // One method per seller: the cart's method whose option belongs to the group.
  const selectedOptionFor = (group: CartShippingGroup) =>
    group.shipping_options.find((option) =>
      cart.shipping_methods?.some(
        (method) => method.shipping_option_id === option.id
      )
    )

  const everyGroupChosen =
    groups.length > 0 &&
    groups.every((group) => !!selectedOptionFor(group))

  const handleEdit = () => {
    router.push(pathname + "?step=delivery", { scroll: false })
  }

  const handleSubmit = () => {
    router.push(pathname + "?step=payment", { scroll: false })
  }

  const set = async (id: string) => {
    setIsLoading(true)
    await setShippingMethod({ cartId: cart.id, shippingMethodId: id })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && cart.shipping_methods?.length === 0,
            }
          )}
        >
          Delivery
          {!isOpen && (cart.shipping_methods?.length ?? 0) > 0 && (
            <CheckCircleSolid />
          )}
        </Heading>
        {!isOpen &&
          cart?.shipping_address &&
          cart?.billing_address &&
          cart?.email && (
            <Text>
              <button
                onClick={handleEdit}
                className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                data-testid="edit-delivery-button"
              >
                Edit
              </button>
            </Text>
          )}
      </div>
      {isOpen ? (
        <div data-testid="delivery-options-container">
          <div className="pb-8">
            {groups.map((group) => {
              const selected = selectedOptionFor(group)
              const title = groupTitle(group, groups.length)

              return (
                <div
                  key={group.shipping_profile_id}
                  className="mb-6"
                  data-testid="delivery-group"
                >
                  {title && (
                    <Text className="txt-medium-plus text-ui-fg-base mb-2">
                      Shipping from {title}
                    </Text>
                  )}
                  {group.shipping_options.length === 0 ? (
                    <Text className="txt-medium text-ui-fg-subtle">
                      No delivery options are available for these items.
                    </Text>
                  ) : (
                    <RadioGroup value={selected?.id || ""} onChange={set}>
                      {group.shipping_options.map((option) => (
                        <RadioGroup.Option
                          key={option.id}
                          value={option.id}
                          data-testid="delivery-option-radio"
                          className={clx(
                            "flex items-center justify-between text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
                            {
                              "border-ui-border-interactive":
                                option.id === selected?.id,
                            }
                          )}
                        >
                          <div className="flex items-center gap-x-4">
                            <Radio checked={option.id === selected?.id} />
                            <span className="text-base-regular">
                              {option.name}
                            </span>
                          </div>
                          <span className="justify-self-end text-ui-fg-base">
                            {convertToLocale({
                              amount: option.amount!,
                              currency_code: cart?.currency_code,
                            })}
                          </span>
                        </RadioGroup.Option>
                      ))}
                    </RadioGroup>
                  )}
                </div>
              )
            })}
          </div>

          <ErrorMessage
            error={error}
            data-testid="delivery-option-error-message"
          />

          <Button
            size="large"
            className="mt-6"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={!everyGroupChosen}
            data-testid="submit-delivery-option-button"
          >
            Continue to payment
          </Button>
        </div>
      ) : (
        <div>
          <div className="text-small-regular">
            {cart && (cart.shipping_methods?.length ?? 0) > 0 && (
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Method
                </Text>
                {groups.map((group) => {
                  const selected = selectedOptionFor(group)
                  if (!selected) {
                    return null
                  }
                  const title = groupTitle(group, groups.length)
                  return (
                    <Text
                      key={group.shipping_profile_id}
                      className="txt-medium text-ui-fg-subtle"
                    >
                      {title ? `${title}: ` : ""}
                      {selected.name}{" "}
                      {convertToLocale({
                        amount: selected.amount!,
                        currency_code: cart?.currency_code,
                      })}
                    </Text>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Shipping
