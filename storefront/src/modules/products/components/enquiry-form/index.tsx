"use client"

import { submitEnquiry } from "@lib/data/enquiries"
import { Button, Heading, Input, Label, Text, Textarea } from "@medusajs/ui"
import { useState } from "react"

export type EnquiryField = {
  id: string
  type:
    | "text"
    | "long_text"
    | "email"
    | "phone"
    | "number"
    | "dropdown"
    | "radio"
    | "checkbox"
  label: string
  required: boolean
  order: number
  options?: string[]
}

// Common dial codes. The backend only accepts E.164 (+<country><number>), so the
// shopper picks a code and types their number; the two are joined here.
const DIAL_CODES = [
  { code: "1", label: "+1 (US/Canada)" },
  { code: "44", label: "+44 (UK)" },
  { code: "91", label: "+91 (India)" },
  { code: "977", label: "+977 (Nepal)" },
  { code: "61", label: "+61 (Australia)" },
  { code: "49", label: "+49 (Germany)" },
  { code: "33", label: "+33 (France)" },
  { code: "971", label: "+971 (UAE)" },
  { code: "65", label: "+65 (Singapore)" },
  { code: "81", label: "+81 (Japan)" },
]

type Answers = Record<string, string | string[]>

const selectClass =
  "h-11 rounded-rounded border border-line bg-card px-2 text-sm text-ink focus:border-brand focus:outline-none"

/**
 * "Ask a question" form for a product that takes enquiries instead of orders.
 * Email and message are always asked; the rest come from the seller's
 * configured fields, in the order they set.
 */
export default function EnquiryForm({
  productId,
  productTitle,
  fields,
}: {
  productId: string
  productTitle: string
  fields: EnquiryField[]
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [answers, setAnswers] = useState<Answers>({})
  const [dialCodes, setDialCodes] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const sorted = [...fields].sort((a, b) => a.order - b.order)

  const setAnswer = (id: string, value: string | string[]) =>
    setAnswers((current) => ({ ...current, [id]: value }))

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    // Build the answers the backend expects: empty answers are left out, and a
    // phone is the picked dial code + the digits typed.
    const payload: Answers = {}
    for (const field of sorted) {
      let value = answers[field.id]

      if (field.type === "phone") {
        const digits = ((value as string) ?? "").replace(/\D/g, "")
        value = digits ? `+${dialCodes[field.id] ?? "1"}${digits}` : ""
      }

      const isEmpty = Array.isArray(value) ? value.length === 0 : !value
      if (isEmpty) {
        if (field.required) {
          setError(`Please fill in "${field.label}".`)
          return
        }
        continue
      }
      payload[field.id] = value as string | string[]
    }

    setSubmitting(true)
    const result = await submitEnquiry({
      product_id: productId,
      customer_email: email.trim(),
      message: message.trim(),
      ...(Object.keys(payload).length ? { custom_field_answers: payload } : {}),
    })
    setSubmitting(false)

    if (result.ok) {
      setSent(true)
    } else {
      setError(result.error)
    }
  }

  if (sent) {
    return (
      <div
        className="rounded-large bg-card p-5 shadow-lift"
        data-testid="enquiry-sent"
      >
        <Text className="font-display text-lg font-extrabold text-ink">
          Thanks, your question was sent.
        </Text>
        <Text className="mt-1 text-sm text-muted">
          The seller will reply to {email}.
        </Text>
      </div>
    )
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-y-3" data-testid="enquiry-cta">
        <Text className="text-sm text-muted">
          This product is available on enquiry. Send the seller a question and they
          will reply by email.
        </Text>
        <Button
          variant="primary"
          className="h-12 w-full !rounded-large !border-0 !bg-brand !font-extrabold !text-brand-ink !shadow-none hover:!opacity-90 disabled:!bg-line disabled:!text-muted"
          onClick={() => setOpen(true)}
          data-testid="ask-a-question"
        >
          Ask a question
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-y-4 rounded-large bg-card p-5 shadow-lift"
      data-testid="enquiry-form"
    >
      <Heading level="h3" className="font-display text-xl font-extrabold tracking-tight">
        Ask about {productTitle}
      </Heading>

      <div className="flex flex-col gap-y-1">
        <Label htmlFor="enquiry-email">Your email *</Label>
        <Input
          id="enquiry-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-y-1">
        <Label htmlFor="enquiry-message">Your question *</Label>
        <Textarea
          id="enquiry-message"
          required
          maxLength={2000}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {sorted.map((field) => {
        const id = `enquiry-${field.id}`
        const label = `${field.label}${field.required ? " *" : ""}`
        const value = answers[field.id]
        const text = (value as string) ?? ""

        return (
          <div key={field.id} className="flex flex-col gap-y-1">
            <Label htmlFor={id}>{label}</Label>

            {field.type === "text" && (
              <Input id={id} value={text} onChange={(e) => setAnswer(field.id, e.target.value)} />
            )}

            {field.type === "long_text" && (
              <Textarea id={id} rows={3} value={text} onChange={(e) => setAnswer(field.id, e.target.value)} />
            )}

            {field.type === "email" && (
              <Input id={id} type="email" value={text} onChange={(e) => setAnswer(field.id, e.target.value)} />
            )}

            {field.type === "number" && (
              <Input id={id} type="number" value={text} onChange={(e) => setAnswer(field.id, e.target.value)} />
            )}

            {field.type === "phone" && (
              <div className="flex gap-x-2">
                <select
                  aria-label="Country code"
                  className={selectClass}
                  value={dialCodes[field.id] ?? "1"}
                  onChange={(e) =>
                    setDialCodes((current) => ({ ...current, [field.id]: e.target.value }))
                  }
                >
                  {DIAL_CODES.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <Input
                  id={id}
                  type="tel"
                  inputMode="tel"
                  placeholder="Phone number"
                  value={text}
                  onChange={(e) => setAnswer(field.id, e.target.value)}
                />
              </div>
            )}

            {field.type === "dropdown" && (
              <select
                id={id}
                className={selectClass}
                value={text}
                onChange={(e) => setAnswer(field.id, e.target.value)}
              >
                <option value="">Select...</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}

            {field.type === "radio" && (
              <div className="flex flex-wrap gap-2">
                {(field.options ?? []).map((option) => (
                  <label key={option} className="flex w-fit cursor-pointer items-center gap-2 rounded-circle border border-line bg-card px-3.5 py-2 text-sm font-semibold">
                    <input
                      className="accent-brand"
                      type="radio"
                      name={id}
                      checked={value === option}
                      onChange={() => setAnswer(field.id, option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            )}

            {field.type === "checkbox" && (
              <div className="flex flex-wrap gap-2">
                {(field.options ?? []).map((option) => {
                  const selected = (Array.isArray(value) ? value : []) as string[]
                  return (
                    <label key={option} className="flex w-fit cursor-pointer items-center gap-2 rounded-circle border border-line bg-card px-3.5 py-2 text-sm font-semibold">
                      <input
                        className="accent-brand"
                        type="checkbox"
                        checked={selected.includes(option)}
                        onChange={(e) =>
                          setAnswer(
                            field.id,
                            e.target.checked
                              ? [...selected, option]
                              : selected.filter((o) => o !== option)
                          )
                        }
                      />
                      {option}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {error && (
        <Text className="text-sm font-semibold text-brand" data-testid="enquiry-error">
          {error}
        </Text>
      )}

      <div className="flex gap-x-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1 !rounded-large !border-0 !bg-brand !font-extrabold !text-brand-ink !shadow-none hover:!opacity-90 disabled:!bg-line disabled:!text-muted"
          isLoading={submitting}
          disabled={submitting || !email.trim() || !message.trim()}
          data-testid="send-enquiry"
        >
          Send enquiry
        </Button>
      </div>
    </form>
  )
}
