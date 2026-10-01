import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ReceiptPercent, ArrowRight } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"

const CommercePromotionsPage = () => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate("/promotions", { replace: true })
  }, [navigate])

  return (
    <Container className="p-8 flex flex-col items-center justify-center text-center py-16 max-w-xl mx-auto">
      <div className="w-12 h-12 rounded-xl bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center mb-4 text-ui-fg-base">
        <ReceiptPercent className="w-6 h-6" />
      </div>
      <Heading level="h2" className="text-lg font-semibold">
        Promotions & Discounts
      </Heading>
      <Text className="text-ui-fg-subtle text-sm max-w-md mt-2">
        Taking you to Promotions campaigns and rules...
      </Text>
      <Button
        variant="secondary"
        size="small"
        className="mt-6"
        onClick={() => navigate("/promotions")}
      >
        <span>Open Promotions</span>
        <ArrowRight className="ml-1 w-3.5 h-3.5" />
      </Button>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Promotions",
  rank: 5,
})

export default CommercePromotionsPage
