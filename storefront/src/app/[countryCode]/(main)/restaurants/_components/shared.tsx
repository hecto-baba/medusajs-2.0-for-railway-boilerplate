"use client"

import React from "react"
import RemoteImage from "@modules/appointments/components/remote-image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const SuccessBanner = ({ title }: { title: string }) => (
  <div
    role="status"
    className="mb-5 flex items-center justify-between gap-3 rounded-large bg-success-soft p-4 text-sm text-success"
  >
    <span className="min-w-0 break-words">
      Added <strong>{title}</strong> to your cart.
    </span>
    <LocalizedClientLink
      href="/cart"
      className="shrink-0 font-extrabold underline"
    >
      View cart
    </LocalizedClientLink>
  </div>
)

export const ErrorBanner = ({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) => (
  <div
    role="alert"
    className="mb-5 flex items-center justify-between gap-3 rounded-large bg-brand-soft p-4 text-sm text-brand"
  >
    <span className="min-w-0 break-words">{message}</span>
    <button
      onClick={onDismiss}
      className="shrink-0 text-xs font-extrabold hover:underline"
    >
      Dismiss
    </button>
  </div>
)

export const AddButton = ({
  disabled,
  loading,
  closed,
  label = "ADD",
  onClick,
  ariaLabel,
  className = "",
}: {
  disabled?: boolean
  loading?: boolean
  closed?: boolean
  label?: string
  onClick: () => void
  ariaLabel?: string
  className?: string
}) => (
  <button
    type="button"
    aria-label={ariaLabel}
    disabled={disabled || loading}
    onClick={onClick}
    className={`h-9 min-w-[88px] rounded-rounded px-4 text-sm font-extrabold tracking-wide transition-colors active:scale-[0.97] disabled:cursor-not-allowed ${
      closed
        ? "border border-line bg-canvas text-muted"
        : "border-[1.5px] border-brand bg-card text-brand hover:bg-brand-soft disabled:opacity-60"
    } ${className}`}
  >
    {closed ? "Closed" : loading ? "Adding..." : label}
  </button>
)

export const ConflictDialog = ({
  message,
  onCancel,
  onConfirm,
}: {
  message: string
  onCancel: () => void
  onConfirm: () => void
}) => (
  <div
    role="dialog"
    aria-modal="true"
    className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
  >
    <div className="w-full max-w-md rounded-large border border-line bg-card p-6 shadow-pop">
      <h3 className="mb-2 font-display text-lg font-extrabold tracking-tight text-ink">
        Replace Cart Items?
      </h3>
      <p className="mb-6 text-sm text-muted">{message}</p>
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="h-10 rounded-large border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-canvas"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="h-10 rounded-large bg-brand px-4 text-sm font-extrabold text-brand-ink hover:opacity-90"
        >
          Clear Cart & Add
        </button>
      </div>
    </div>
  </div>
)

/** Square cover tile: the image when there is one, otherwise the initial. */
export const CoverTile = ({
  src,
  name,
  className = "",
}: {
  src?: string
  name: string
  className?: string
}) => (
  <div
    className={`flex items-center justify-center overflow-hidden bg-brand-soft ${className}`}
  >
    {src ? (
      <RemoteImage
        src={src}
        alt={name}
        width={80}
        height={80}
        className="h-full w-full object-cover"
      />
    ) : (
      <span
        aria-hidden
        className="font-display text-3xl font-extrabold text-brand"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    )}
  </div>
)
