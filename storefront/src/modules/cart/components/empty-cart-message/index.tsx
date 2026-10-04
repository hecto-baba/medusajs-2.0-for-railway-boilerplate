import { Heading, Text } from "@medusajs/ui"

import InteractiveLink from "@modules/common/components/interactive-link"

const EmptyCartMessage = () => {
  return (
    <div
      className="flex flex-col items-start justify-center rounded-large bg-card px-6 py-24 shadow-lift small:px-12"
      data-testid="empty-cart-message"
    >
      <Heading
        level="h1"
        className="flex flex-row items-baseline gap-x-2 font-display text-3xl font-extrabold tracking-tight"
      >
        Cart
      </Heading>
      <Text className="mb-6 mt-4 max-w-[32rem] text-base text-muted">
        You don&apos;t have anything in your cart. Let&apos;s change that, use
        the link below to start browsing our products.
      </Text>
      <div>
        <InteractiveLink href="/store">Explore products</InteractiveLink>
      </div>
    </div>
  )
}

export default EmptyCartMessage
