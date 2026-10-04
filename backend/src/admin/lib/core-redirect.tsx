import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"

// Sidebar stub for a core Medusa page that is grouped under "Commerce Infra".
// It only forwards to the real page.
export const CoreRedirectPage = ({
  title,
  to,
}: {
  title: string
  to: string
}) => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate(to, { replace: true })
  }, [navigate, to])

  return (
    <Container className="p-8 flex flex-col items-center justify-center text-center py-16 max-w-xl mx-auto">
      <Heading level="h2" className="text-lg font-semibold">
        {title}
      </Heading>
      <Text className="text-ui-fg-subtle text-sm max-w-md mt-2">
        Taking you to {title}...
      </Text>
      <Button
        variant="secondary"
        size="small"
        className="mt-6"
        onClick={() => navigate(to)}
      >
        <span>Open {title}</span>
        <ArrowRight className="ml-1 w-3.5 h-3.5" />
      </Button>
    </Container>
  )
}
