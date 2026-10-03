/**
 * Shared shape for a product enquiry's admin-authored custom field schema
 * (stored as EnquiryConfiguration.custom_fields, plain JSON - see
 * docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md, Design section) and for
 * validating a customer's answers against it in create-enquiry.ts.
 */
export const ENQUIRY_FIELD_TYPES = [
  "text",
  "long_text",
  "email",
  "phone",
  "number",
  "dropdown",
  "radio",
  "checkbox",
] as const

export type EnquiryFieldType = (typeof ENQUIRY_FIELD_TYPES)[number]

export const ENQUIRY_CHOICE_FIELD_TYPES: EnquiryFieldType[] = [
  "dropdown",
  "radio",
  "checkbox",
]

export type EnquiryFieldDefinition = {
  /** Stable id, generated once by the admin UI - referenced by answers, never the label. */
  id: string
  type: EnquiryFieldType
  label: string
  required: boolean
  /** Admin-controlled position - the array order in custom_fields is also respected on save. */
  order: number
  /** dropdown / radio / checkbox only. */
  options?: string[]
}

/** checkbox answers are string[] (multi-select); every other type is a single string. */
export type EnquiryFieldAnswers = Record<string, string | string[]>
