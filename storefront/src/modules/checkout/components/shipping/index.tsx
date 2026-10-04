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
  // The option the shopper just picked, per seller group. Saving a delivery
  // method is a slow backend call, so the choice is shown straight away and
  // kept until the saved cart agrees (or the save fails and it is dropped).
  const [pending, setPending] = useState<Record<string, string>>({})

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

  const set = async (groupKey: string, id: string) => {
    setError(null)
    setPending((current) => ({ ...current, [groupKey]: id }))
    setIsLoading(true)
    await setShippingMethod({ cartId: cart.id, shippingMethodId: id })
      .catch((err) => {
        setError(err.message)
        setPending((current) => {
          const next = { ...current }
          delete next[groupKey]
          return next
        })
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  // Once the saved cart shows the choice, the local copy is no longer needed.
  useEffect(() => {
    setPending((current) => {
      const next = { ...current }
      let changed = false
      for (const group of groups) {
        const saved = selectedOptionFor(group)
        if (saved && next[group.shipping_profile_id] === saved.id) {
          delete next[group.shipping_profile_id]
          changed = true
        }
      }
      return changed ? next : current
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.shipping_methods])

  useEffect(() => {
    setError(null)
  }, [isOpen])

  return (
    <div className="rounded-large bg-card p-5 shadow-lift small:p-6">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row font-display text-2xl font-extrabold tracking-tight gap-x-2 items-baseline",
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
                className="text-brand hover:underline"
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
              const chosenId = pending[group.shipping_profile_id] ?? selected?.id
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
                    <RadioGroup
                      value={chosenId || ""}
                      onChange={(id: string) => set(group.shipping_profile_id, id)}
                    >
                      {group.shipping_options.map((option) => (
                        <RadioGroup.Option
                          key={option.id}
                          value={option.id}
                          data-testid="delivery-option-radio"
                          className={clx(
                            "flex items-center justify-between text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
                            {
                              "border-brand bg-brand-soft":
                                option.id === chosenId,
                            }
                          )}
                        >
                          <div className="flex items-center gap-x-4">
                            <Radio checked={option.id === chosenId} />
                            <span className="text-base-regular">
                              {option.name}
                            </span>
                            {isLoading && pending[group.shipping_profile_id] === option.id && (
                              <span
                                className="text-xs font-semibold text-muted"
                                role="status"
                                data-testid="delivery-saving"
                              >
                                Saving…
                              </span>
                            )}
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
            {isLoading ? "Saving your choice…" : "Continue to payment"}
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
