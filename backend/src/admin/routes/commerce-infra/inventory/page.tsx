import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Buildings, ArrowRight } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"

const CommerceInventoryPage = () => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate("/inventory", { replace: true })
  }, [navigate])

  return (
    <Container className="p-8 flex flex-col items-center justify-center text-center py-16 max-w-xl mx-auto">
      <div className="w-12 h-12 rounded-xl bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center mb-4 text-ui-fg-base">
        <Buildings className="w-6 h-6" />
      </div>
      <Heading level="h2" className="text-lg font-semibold">
        Inventory Management
      </Heading>
      <Text className="text-ui-fg-subtle text-sm max-w-md mt-2">
        Taking you to Inventory stock and location tracking...
      </Text>
      <Button
        variant="secondary"
        size="small"
        className="mt-6"
        onClick={() => navigate("/inventory")}
      >
        <span>Open Inventory</span>
        <ArrowRight className="ml-1 w-3.5 h-3.5" />
      </Button>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Inventory",
  rank: 3,
})

export default CommerceInventoryPage
