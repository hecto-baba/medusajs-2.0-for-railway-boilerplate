import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SignInPrompt = () => {
  return (
    <div className="flex items-center justify-between gap-4 rounded-large bg-canvas p-4">
      <div>
        <Heading level="h2" className="font-display text-lg font-extrabold">
          Already have an account?
        </Heading>
        <Text className="mt-1 text-sm text-muted">
          Sign in for a better experience.
        </Text>
      </div>
      <LocalizedClientLink
        href="/account"
        data-testid="sign-in-button"
        className="shrink-0 rounded-rounded border-[1.5px] border-brand bg-card px-4 py-2 text-sm font-extrabold text-brand transition-colors hover:bg-brand-soft"
      >
        Sign in
      </LocalizedClientLink>
    </div>
  )
}

export default SignInPrompt
