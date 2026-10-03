import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  validateWeeklyWindow,
  weeklyWindowsOverlap,
} from "../../../../../../modules/appointment-booking/lib/availability"
import { isUniqueViolation } from "../../../../../../modules/appointment-booking/lib/db-errors"
import { assertResourceOwned, getAppointmentService } from "../../../helpers"
import { UpdateHoursSchema } from "../../../schemas"

const dateKey = (value: Date | string) => new Date(value).toISOString().slice(0, 10)
const calendarDate = (value: Date | string) =>
  new Date(`${dateKey(value)}T00:00:00.000Z`)

const loadRule = async (
  req: AuthenticatedMedusaRequest,
  resourceId: string,
  ruleId: string
) => {
  const service = getAppointmentService(req)
  // Scoped to the resource already proven to be the caller's: a rule id from
  // another resource (or vendor) is simply "not found".
  const [rule] = await service.listRecurringAvailabilities(
    { id: ruleId, provider_id: resourceId },
    { take: 1 }
  )
  if (!rule) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Weekly hours not found.")
  }
  return { service, rule }
}

/** Edit a window, move its dates, or switch it on/off. */
export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateHoursSchema>>,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const { service, rule } = await loadRule(req, resource.id, req.params.ruleId)

  const body = req.validatedBody
  const next = {
    day_of_week: rule.day_of_week,
    start_time: body.start_time ?? rule.start_time,
    end_time: body.end_time ?? rule.end_time,
    effective_from: body.effective_from ? calendarDate(body.effective_from) : rule.effective_from,
    effective_until:
      body.effective_until === undefined
        ? rule.effective_until
        : body.effective_until
          ? calendarDate(body.effective_until)
          : null,
    status: body.status ?? rule.status,
  }

  const problem = validateWeeklyWindow(next)
  if (problem) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, problem)
  }

  if (next.status === "active") {
    const siblings = await service.listRecurringAvailabilities(
      { provider_id: resource.id, day_of_week: rule.day_of_week, status: "active" },
      { take: null }
    )
    const mine = {
      from: dateKey(next.effective_from),
      until: next.effective_until ? dateKey(next.effective_until) : null,
    }
    const clash = siblings.find(
      (r) =>
        r.id !== rule.id &&
        weeklyWindowsOverlap(r, next) &&
        (mine.until === null || dateKey(r.effective_from) <= mine.until) &&
        (!r.effective_until || mine.from <= dateKey(r.effective_until))
    )
    if (clash) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `These hours overlap existing hours on the same day (${clash.start_time}-${clash.end_time}).`
      )
    }
  }

  try {
    const updated = await service.updateRecurringAvailabilities({
      id: rule.id,
      start_time: next.start_time,
      end_time: next.end_time,
      effective_from: next.effective_from,
      effective_until: next.effective_until,
      status: next.status,
    })
    res.json({ hours: updated })
  } catch (err: any) {
    if (isUniqueViolation(err)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "Identical hours already exist for this day."
      )
    }
    throw err
  }
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const resource = await assertResourceOwned(req, req.params.id)
  const { service, rule } = await loadRule(req, resource.id, req.params.ruleId)

  await service.deleteRecurringAvailabilities(rule.id)

  res.json({ id: rule.id, deleted: true })
}
