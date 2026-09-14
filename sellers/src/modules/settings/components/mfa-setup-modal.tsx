"use client"

import {
  cancelPendingMfa,
  generateMfaRecoveryCodes,
  verifyMfaFactor,
  type MfaSetupResponse,
} from "@lib/data/vendor-mfa"
import { Button, Copy, FocusModal, Heading, Hint, OtpInput, Text } from "@medusajs/ui"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { MfaQrCode } from "./mfa-qr-code"

type MfaSetupModalProps = {
  setup: MfaSetupResponse
  onClose: () => void
}

/**
 * The setup flow after "Enable" is pressed: scan a QR code, verify a 6-digit
 * code, then save recovery codes. Ported from the dashboard's
 * mfa-setup-modal.tsx - same two-step FocusModal, same OtpInput auto-submit
 * on the 6th digit, same download/copy actions on the recovery step.
 *
 * `onClose` (the parent clearing its setup state) doubles as cancellation: if
 * the vendor closes before verifying, the pending factor is left behind on
 * the backend, so it is explicitly cancelled here rather than only on the
 * happy path - otherwise a second "Enable" click would find a stale pending
 * factor and the backend would refuse a second one.
 */
export const MfaSetupModal = ({ setup, onClose }: MfaSetupModalProps) => {
  const [step, setStep] = useState<"verify" | "recovery-codes">("verify")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])

  const secret = setup.secret
  const otpauthUrl = setup.otpauth_url

  const { mutateAsync: verify, isPending: isVerifying } = useMutation({
    mutationFn: (nextCode: string) => verifyMfaFactor(setup.mfa_factor.id, nextCode),
  })
  const { mutateAsync: generateRecoveryCodes, isPending: isGenerating } =
    useMutation({ mutationFn: generateMfaRecoveryCodes })
  const { mutate: cancelPending } = useMutation({
    mutationFn: () => cancelPendingMfa(setup.mfa_factor.id),
  })

  const generateAndShowRecoveryCodes = async () => {
    setError(null)

    try {
      const { recovery_codes } = await generateRecoveryCodes()
      setRecoveryCodes(recovery_codes)
      setStep("recovery-codes")
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not generate recovery codes."
      )
    }
  }

  const handleVerify = async (nextCode = code) => {
    if (isVerified) {
      await generateAndShowRecoveryCodes()
      return
    }

    if (nextCode.length !== 6) {
      return
    }

    setError(null)

    try {
      await verify(nextCode)
      setIsVerified(true)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That code did not verify. Please try again."
      )
      setCode("")
      return
    }

    await generateAndShowRecoveryCodes()
  }

  const handleClose = () => {
    if (!isVerified) {
      cancelPending()
    }

    onClose()
  }

  const handleDownloadRecoveryCodes = () => {
    const blob = new Blob([recoveryCodes.join("\n")], {
      type: "text/plain;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = "vendor-panel-recovery-codes.txt"
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <FocusModal open onOpenChange={(open) => !open && handleClose()}>
      <FocusModal.Content className="inset-auto left-1/2 top-1/2 max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2">
        <FocusModal.Header>
          <FocusModal.Title asChild>
            <span className="sr-only">
              {step === "verify"
                ? "Set up two-factor authentication"
                : "Save your recovery codes"}
            </span>
          </FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="overflow-y-auto p-6">
          {step === "verify" ? (
            <div className="flex w-full flex-col items-center gap-y-6">
              <div className="flex flex-col items-center gap-y-2 text-center">
                <Heading>Set up an authenticator app</Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Scan the QR code with your authenticator app, then enter the
                  6-digit code it generates.
                </Text>
              </div>
              {secret && otpauthUrl ? (
                <div className="border-ui-border-base flex w-full flex-col items-center gap-y-4 rounded-lg border p-4">
                  <div className="bg-ui-bg-subtle txt-compact-small text-ui-fg-base border-ui-border-base flex max-w-full items-center gap-x-2 rounded-md border px-3 py-2 font-mono">
                    <span className="truncate">{secret}</span>
                    <Copy content={secret} variant="mini" />
                  </div>
                  <MfaQrCode value={otpauthUrl} />
                </div>
              ) : (
                <Hint className="inline-flex" variant="error">
                  Could not start two-factor setup. Please try again.
                </Hint>
              )}
              <div className="flex flex-col items-center gap-y-3">
                <OtpInput
                  value={code}
                  onChange={setCode}
                  onComplete={handleVerify}
                  disabled={isVerifying || isGenerating || !secret || isVerified}
                  autoFocus
                />
                {error && (
                  <Hint className="inline-flex" variant="error">
                    {error}
                  </Hint>
                )}
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-y-4">
              <div>
                <Heading>Save your recovery codes</Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Store these somewhere safe. Each code can be used once if you
                  lose access to your authenticator app.
                </Text>
              </div>
              <div className="border-ui-border-base bg-ui-bg-subtle grid grid-cols-2 gap-3 rounded-lg border p-4">
                {recoveryCodes.map((recoveryCode) => (
                  <Text key={recoveryCode} size="small" className="font-mono">
                    {recoveryCode}
                  </Text>
                ))}
              </div>
            </div>
          )}
        </FocusModal.Body>
        <FocusModal.Footer>
          {step === "verify" ? (
            <>
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                isLoading={isVerifying || isGenerating}
                disabled={(!isVerified && code.length !== 6) || !secret}
                onClick={() => handleVerify()}
              >
                Confirm
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={handleDownloadRecoveryCodes}>
                Download
              </Button>
              <Copy content={recoveryCodes.join("\n")} asChild>
                <Button variant="secondary">Copy</Button>
              </Copy>
              <Button onClick={onClose}>Done</Button>
            </>
          )}
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}
