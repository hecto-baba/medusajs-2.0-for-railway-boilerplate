"use client"

import React from "react"

/**
 * A form that can only be submitted when using the meta or control key.
 *
 * Ported from the dashboard's components/utilities/keybound-form.
 */
type FormSubmitEvent = Parameters<
  NonNullable<React.FormHTMLAttributes<HTMLFormElement>["onSubmit"]>
>[0]

export const KeyboundForm = React.forwardRef<
  HTMLFormElement,
  React.FormHTMLAttributes<HTMLFormElement>
>(({ onSubmit, onKeyDown, ...rest }, ref) => {
  const handleSubmit = (event: FormSubmitEvent) => {
    event.preventDefault()
    onSubmit?.(event)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter") {
      if (
        event.target instanceof HTMLTextAreaElement &&
        !(event.metaKey || event.ctrlKey)
      ) {
        return
      }

      event.preventDefault()

      if (event.metaKey || event.ctrlKey) {
        // React 19 types a submit handler's event as SubmitEvent, which carries
        // a `submitter` a keyboard event has no equivalent of. The handler only
        // reads preventDefault, so the cast is safe and keeps ⌘↵ working.
        handleSubmit(event as unknown as FormSubmitEvent)
      }
    }
  }

  return (
    <form
      {...rest}
      onSubmit={handleSubmit}
      onKeyDown={onKeyDown ?? handleKeyDown}
      ref={ref}
    />
  )
})

KeyboundForm.displayName = "KeyboundForm"
