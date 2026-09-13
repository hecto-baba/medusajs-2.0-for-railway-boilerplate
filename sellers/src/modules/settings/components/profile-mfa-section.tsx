"use client"

import {
  cancelPendingMfa,
  disableMfaFactor,
  listMfaFactors,
  startMfaSetup,
  type MfaFactor,
  type MfaSetupResponse,
} from "@lib/data/vendor-mfa"
import { Key, ShieldCheck } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { MfaDisableModal } from "./mfa-disable-modal"
import { MfaSetupModal } from "./mfa-setup-modal"

const MFA_DISABLE_CODE_REQUIRED_ERROR =
  "MFA verification code is required to disable MFA"

/**
 * Two-factor authentication section of the Profile page. Ported from the
 * dashboard's profile-mfa-section.tsx onto TanStack Query directly (the
 * dashboard uses its own useAuthMfa/useDisableAuthMfa/useStartAuthMfa hooks
 * over the same backend routes; this calls the client helpers in
 * vendor-mfa.ts, which hit the same /auth/mfa/* endpoints through our proxy).
 *
 * The two-step disable flow mirrors the backend's own behaviour: disabling a
 * still-pending factor needs no code (cancelPendingMfa), but disabling an
 * enabled one is refused without a challenge - the backend's error message is
 * the only signal for that, so it is matched by substring, same as the
 * dashboard does.
 */
export const ProfileMfaSection = () => {
  const prompt = usePrompt()
  const [setupResponse, setSetupResponse] = useState<MfaSetupResponse | null>(
    null
  )
  const [disableChallengeFactor, setDisableChallengeFactor] =
    useState<MfaFactor | null>(null)

  const { data, isPending, refetch } = useQuery({
    queryKey: ["vendor-mfa-factors"],
    queryFn: listMfaFactors,
  })
  const factors = data?.mfa_factors ?? []

  const enabledFactor = useMemo(
    () => factors.find((factor) => factor.status === "enabled"),
    [factors]
  )
  const pendingFactor = useMemo(
    () => factors.find((factor) => factor.status === "pending"),
    [factors]
  )

  const { mutateAsync: startMfa, isPending: isStarting } = useMutation({
    mutationFn: (label: string) => startMfaSetup(label),
  })
  const { mutateAsync: cancelPending, isPending: isCancellingPending } =
    useMutation({
      mutationFn: (factorId: string) => cancelPendingMfa(factorId),
    })
  const { mutateAsync: disableMfa, isPending: isDisabling } = useMutation({
    mutationFn: (factorId: string) => disableMfaFactor(factorId),
  })

  const handleSetup = async () => {
    try {
      if (pendingFactor) {
        await cancelPending(pendingFactor.id)
      }

      const response = await startMfa("Authenticator app")
      setSetupResponse(response)
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Could not start two-factor setup. Please try again."
      )
    }
  }

  const handleDisable = async () => {
    if (!enabledFactor) {
      return
    }

    const confirmed = await prompt({
      title: "Disable two-factor authentication",
      description:
        "Your account will no longer require a verification code at sign-in.",
      confirmText: "Disable",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    try {
      await disableMfa(enabledFactor.id)
      toast.success("Two-factor authentication disabled")
      refetch()
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.includes(MFA_DISABLE_CODE_REQUIRED_ERROR)
      ) {
        setDisableChallengeFactor(enabledFactor)
        return
      }

      toast.error(
        e instanceof Error
          ? e.message
          : "Could not disable two-factor authentication."
      )
    }
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading>Two-factor authentication</Heading>
            <Text className="text-ui-fg-subtle" size="small">
              Add an extra layer of security to your account
            </Text>
          </div>
          {enabledFactor ? (
            <Button
              size="small"
              variant="danger"
              isLoading={isDisabling}
              onClick={handleDisable}
            >
              Disable
            </Button>
          ) : (
            <Button
              size="small"
              variant="secondary"
              isLoading={isStarting || isCancellingPending}
              disabled={isPending}
              onClick={handleSetup}
            >
              Enable
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 items-center px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            Status
          </Text>
          <div>
            {enabledFactor ? (
              <Badge color="green" size="2xsmall">
                Enabled
              </Badge>
            ) : pendingFactor ? (
              <Badge color="orange" size="2xsmall">
                Pending
              </Badge>
            ) : (
              <Badge color="grey" size="2xsmall">
                Disabled
              </Badge>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 items-center px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            Method
          </Text>
          <div className="flex items-center gap-x-2">
            {enabledFactor || pendingFactor ? (
              <>
                <ShieldCheck className="text-ui-fg-subtle" />
                <Text size="small" leading="compact">
                  Authenticator app
                </Text>
              </>
            ) : (
              <>
                <Key className="text-ui-fg-muted" />
                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                  No method configured
                </Text>
              </>
            )}
          </div>
        </div>
      </Container>

      {setupResponse && (
        <MfaSetupModal
          setup={setupResponse}
          onClose={() => {
            setSetupResponse(null)
            refetch()
          }}
        />
      )}

      {disableChallengeFactor && (
        <MfaDisableModal
          factor={disableChallengeFactor}
          onClose={() => setDisableChallengeFactor(null)}
          onSuccess={() => {
            setDisableChallengeFactor(null)
            toast.success("Two-factor authentication disabled")
            refetch()
          }}
        />
      )}
    </>
  )
}
