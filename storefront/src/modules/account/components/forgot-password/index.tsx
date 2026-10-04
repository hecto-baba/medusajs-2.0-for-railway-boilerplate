"use client"

import { useActionState } from "react"

import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import Input from "@modules/common/components/input"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import { requestPasswordReset } from "@lib/data/customer"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const ForgotPassword = ({ setCurrentView }: Props) => {
  const [state, formAction] = useActionState(requestPasswordReset, {
    success: false,
    error: null,
  })

  return (
    <div
      className="w-full flex flex-col items-center"
      data-testid="forgot-password-page"
    >
      <h1 className="font-display text-3xl font-extrabold tracking-tight mb-2 text-center">Reset your password</h1>

      {state.success ? (
        <>
          {/*
            Deliberately does not confirm that an account exists. The backend
            answers the same way for an unknown address so the form cannot be
            used to find out who has an account here, and saying "check your
            inbox" would undo that on the very next line.
          */}
          <p
            className="text-center text-base text-muted mb-8"
            data-testid="forgot-password-sent"
          >
            If an account exists for that address, a link to set a new password
            is on its way. It can be used once and expires in 15 minutes.
          </p>
          <button
            onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
            className="text-sm font-bold text-brand hover:underline"
            data-testid="back-to-sign-in-button"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <p className="text-center text-base text-muted mb-8">
            Enter the email address on your account and we will send you a link
            to set a new password.
          </p>
          <form className="w-full" action={formAction}>
            <Input
              label="Email"
              name="email"
              type="email"
              title="Enter a valid email address."
              autoComplete="email"
              required
              data-testid="forgot-password-email-input"
            />
            <ErrorMessage
              error={state.error}
              data-testid="forgot-password-error-message"
            />
            <SubmitButton
              data-testid="send-reset-link-button"
              className="w-full mt-6"
            >
              Send reset link
            </SubmitButton>
          </form>
          <span className="text-center text-muted text-sm mt-6">
            Remembered it?{" "}
            <button
              onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
              className="font-bold text-brand hover:underline"
              data-testid="back-to-sign-in-button"
            >
              Sign in
            </button>
            .
          </span>
        </>
      )}
    </div>
  )
}

export default ForgotPassword
