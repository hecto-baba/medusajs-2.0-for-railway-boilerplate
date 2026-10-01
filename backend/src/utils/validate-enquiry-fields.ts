import { MedusaError } from "@medusajs/framework/utils"
import {
  EnquiryFieldAnswers,
  EnquiryFieldDefinition,
  ENQUIRY_CHOICE_FIELD_TYPES,
} from "./enquiry-field"
import { isValidE164 } from "./validate-e164-phone"

/**
 * Validates an admin's custom_fields schema itself (uniqueness, option
 * lists) - shared by the admin route schema (fail fast, before the
 * workflow runs) and the workflow step (belt-and-suspenders for any other
 * caller). See docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md, Phase C.1.
 */
export const validateEnquiryFieldDefinitions = (
  fields: EnquiryFieldDefinition[]
): void => {
  const seenIds = new Set<string>()

  for (const field of fields) {
    if (seenIds.has(field.id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Duplicate custom field id: "${field.id}".`
      )
    }
    seenIds.add(field.id)

    if (
      ENQUIRY_CHOICE_FIELD_TYPES.includes(field.type) &&
      (!field.options || field.options.filter((o) => o.trim()).length === 0)
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Field "${field.label}" (${field.type}) needs at least one option.`
      )
    }
  }
}

/**
 * Validates a customer's submitted answers against the product's active
 * EnquiryConfiguration.custom_fields. Collects every violation and throws
 * once, rather than failing on the first, so a customer sees every problem
 * in one round trip. See docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md,
 * Phase C.2.
 */
export const validateEnquiryFieldAnswers = (
  fields: EnquiryFieldDefinition[],
  answers: EnquiryFieldAnswers | null | undefined
): void => {
  const safeAnswers = answers ?? {}
  const problems: string[] = []

  for (const field of fields) {
    const answer = safeAnswers[field.id]
    const isEmpty =
      answer === undefined ||
      answer === null ||
      (typeof answer === "string" && answer.trim() === "") ||
      (Array.isArray(answer) && answer.length === 0)

    if (field.required && isEmpty) {
      problems.push(`"${field.label}" is required.`)
      continue
    }

    if (isEmpty) {
      continue
    }

    if (field.type === "checkbox") {
      const values = Array.isArray(answer) ? answer : [answer]
      const invalid = values.filter((v) => !field.options?.includes(v))
      if (invalid.length) {
        problems.push(`"${field.label}" has an invalid selection: ${invalid.join(", ")}.`)
      }
      continue
    }

    if (field.type === "dropdown" || field.type === "radio") {
      if (typeof answer !== "string" || !field.options?.includes(answer)) {
        problems.push(`"${field.label}" has an invalid selection.`)
      }
      continue
    }

    if (field.type === "phone") {
      if (typeof answer !== "string" || !isValidE164(answer)) {
        problems.push(
          `"${field.label}" must be a valid phone number in E.164 format, e.g. +14155552671.`
        )
      }
      continue
    }

    if (field.type === "number") {
      if (typeof answer !== "string" || Number.isNaN(Number(answer))) {
        problems.push(`"${field.label}" must be a number.`)
      }
      continue
    }
  }

  if (problems.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, problems.join(" "))
  }
}
