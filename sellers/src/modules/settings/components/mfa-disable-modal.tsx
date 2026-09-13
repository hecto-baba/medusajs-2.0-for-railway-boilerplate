"use client"

import { disableMfaFactor, type MfaFactor } from "@lib/data/vendor-mfa"
import { Button, FocusModal, Heading, Hint, OtpInput, Text } from "@medusajs/ui"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

type MfaDisableModalProps = {
  factor: MfaFactor
  onClose: () => void
  onSuccess: () => void
}

/**
 * The verification challenge required to disable an already-enabled factor.
 * Ported from the dashboard's mfa-disable-modal.tsx.
 */
export const MfaDisableModal = ({
  factor,
  onClose,
  onSuccess,
}: MfaDisableModalProps) => {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (nextCode: string) =>
      disableMfaFactor(factor.id, { method: factor.provider, code: nextCode }),
  })

  const handleDisable = async (nextCode = code) => {
    if (nextCode.length !== 6) {
      return
    }

    setError(null)

    try {
      await mutateAsync(nextCode)
      onSuccess()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not disable two-factor authentication."
      )
      setCode("")
    }
  }

  return (
    <FocusModal open onOpenChange={(open) => !open && onClose()}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>Disable two-factor authentication</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-[360px] flex-col items-center gap-y-6 text-center">
            <div>
              <Heading>Disable two-factor authentication</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Enter a verification code to confirm.
              </Text>
            </div>
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={handleDisable}
              disabled={isPending}
              autoFocus
            />
            {error && (
              <Hint className="inline-flex" variant="error">
                {error}
              </Hint>
            )}
          </div>
        </FocusModal.Body>
        <FocusModal.Footer>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isPending}
            disabled={code.length !== 6}
            onClick={() => handleDisable()}
          >
            Disable
          </Button>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}
