"use client"

import { Text } from "@medusajs/ui"
import QRCode from "qrcode"
import { useEffect, useRef, useState } from "react"

/**
 * Renders an otpauth:// URL as a scannable QR code. Ported from the
 * dashboard's mfa-qr-code.tsx verbatim - canvas-based rendering, same size and
 * error-correction level, so a screenshot of either panel's setup screen looks
 * the same code at the same size.
 */
export const MfaQrCode = ({ value }: { value: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    setError(false)

    QRCode.toCanvas(canvas, value, {
      margin: 2,
      width: 220,
      errorCorrectionLevel: "M",
    }).catch(() => {
      setError(true)
    })
  }, [value])

  if (error) {
    return (
      <div className="border-ui-border-base bg-ui-bg-subtle flex size-[220px] items-center justify-center rounded-md border">
        <Text size="small" className="text-ui-fg-subtle text-center">
          Could not render the QR code. Use the secret key below instead.
        </Text>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="border-ui-border-base bg-ui-bg-base rounded-md border"
      height={220}
      width={220}
    />
  )
}
