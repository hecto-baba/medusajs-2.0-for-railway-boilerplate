import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { APPOINTMENT_BOOKING_MODULE } from "../../../src/modules/appointment-booking"
import { cancelAppointmentWorkflow } from "../../../src/workflows/cancel-appointment"
import { rescheduleAppointmentWorkflow } from "../../../src/workflows/reschedule-appointment"

jest.setTimeout(10 * 60 * 1000)

const PRODUCT = "prod_changes_test"
// Three months out: inside the booking horizon, far past any notice window or change deadline.
const DAY = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)
// The workflow engine rejects with an error object from another realm, which
// jest's toThrow does not recognise, so the message is checked directly.
const expectRejects = async (promise: Promise<unknown>, pattern: RegExp) => {
  let message: string | null = null
  try {
    await promise
  } catch (error: any) {
    message = String(error?.message ?? error)
  }
  expect(message).not.toBeNull()
  expect(message).toMatch(pattern)
}

const at = (hhmm: string) => new Date(`${DAY}T${hhmm}:00.000Z`)

/**
 * Cancel and reschedule against the real database, so the overlap constraint and
 * the capacity trigger are the ones deciding. Data is created straight through
 * the module (no checkout), then the real workflows are run.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("appointment cancel and reschedule", () => {
      let n = 0
      const svc = () => getContainer().resolve(APPOINTMENT_BOOKING_MODULE) as any

      // A resource open 08:00-18:00 every day on a 30-minute grid.
      const makeResource = async (capacity = 1, vendorId: string | null = null) => {
        const service = svc()
        const resource = await service.createProviders({
          display_name: `Room ${++n}`,
          timezone: "UTC",
          session_duration_minutes: 60,
          slot_step_minutes: 30,
          vendor_id: vendorId,
          capacity,
          min_notice_minutes: 0,
          max_advance_days: 730,
        })
        await service.createRecurringAvailabilities(
          [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({
            provider_id: resource.id,
            day_of_week,
            start_time: "08:00",
            end_time: "18:00",
            effective_from: new Date("2020-01-01T00:00:00.000Z"),
          }))
        )
        await service.createServiceProviders({
          provider_id: resource.id,
          service_product_id: PRODUCT,
          default_duration_minutes: 60,
        })
        return resource
      }

      const book = async (resourceId: string, start: string, who = "Asha", capacity = 1) => {
        const service = svc()
        const [existing] = await service.listAppointments(
          { provider_id: resourceId, start_time: at(start), status: ["booked", "available"] },
          { take: 1 }
        )
        const appointment =
          existing ??
          (await service.createAppointments({
            provider_id: resourceId,
            service_product_id: PRODUCT,
            service_variant_id: "variant_test",
            start_time: at(start),
            end_time: new Date(at(start).getTime() + 3_600_000),
            max_capacity: capacity,
            status: "booked",
          }))
        const attendee = await service.createAppointmentAttendees({
          appointment_id: appointment.id,
          buyer_name: who,
          buyer_email: `${who.toLowerCase()}@example.com`,
          status: "confirmed",
          order_id: `order_${who}`,
        })
        return { appointment, attendee }
      }

      const move = (attendeeId: string, start: string, by: "buyer" | "vendor" | "admin" = "vendor") =>
        rescheduleAppointmentWorkflow(getContainer()).run({
          input: {
            appointment_attendee_id: attendeeId,
            new_start: at(start).toISOString(),
            rescheduled_by: by,
            notify: false,
          },
        })

      const cancel = (attendeeId: string, by: "buyer" | "vendor" = "vendor") =>
        cancelAppointmentWorkflow(getContainer()).run({
          input: {
            appointment_attendee_id: attendeeId,
            cancelled_by: by,
            reason: "Stylist unwell",
            notify: false,
          },
        })

      it("cancel frees the slot so the same time can be booked again", async () => {
        const resource = await makeResource()
        const { appointment, attendee } = await book(resource.id, "10:00")

        await cancel(attendee.id)

        const after = await svc().retrieveAppointmentAttendee(attendee.id)
        expect(after.status).toBe("cancelled")
        expect(after.cancelled_by).toBe("vendor")
        expect((await svc().retrieveAppointment(appointment.id)).status).toBe("cancelled")

        const { slot } = await svc().findBookableSlotAt({
          provider_id: resource.id,
          product_id: PRODUCT,
          start: at("10:00"),
        })
        expect(slot).not.toBeNull()
      })

      it("cancelling twice gives a clear error", async () => {
        const resource = await makeResource()
        const { attendee } = await book(resource.id, "10:00")
        await cancel(attendee.id, "buyer")
        await expectRejects(cancel(attendee.id, "buyer"), /already cancelled/i)
      })

      it("moves a booking alone in its slot in place, including by a half hour overlap", async () => {
        const resource = await makeResource()
        const { appointment, attendee } = await book(resource.id, "10:00")

        await move(attendee.id, "10:30") // overlaps its own old window
        let after = await svc().retrieveAppointmentAttendee(attendee.id)
        let slot = await svc().retrieveAppointment(appointment.id)
        expect(after.status).toBe("confirmed")
        expect(after.appointment_id).toBe(appointment.id)
        expect(new Date(slot.start_time).toISOString()).toBe(at("10:30").toISOString())
        expect(after.reschedule_count).toBe(0) // a business move is not the buyer's
        expect(new Date(after.rescheduled_from_start).toISOString()).toBe(at("10:00").toISOString())
        expect(after.rescheduled_by).toBe("vendor")

        await move(attendee.id, "15:00") // a clear jump
        after = await svc().retrieveAppointmentAttendee(attendee.id)
        slot = await svc().retrieveAppointment(appointment.id)
        expect(new Date(slot.start_time).toISOString()).toBe(at("15:00").toISOString())
        expect(after.reschedule_count).toBe(0)
        expect(slot.status).toBe("booked")

        // The time it left is free again.
        const { slot: freed } = await svc().findBookableSlotAt({
          provider_id: resource.id,
          product_id: PRODUCT,
          start: at("10:00"),
        })
        expect(freed).not.toBeNull()
      })

      it("refuses a time someone else holds and leaves the booking untouched", async () => {
        const resource = await makeResource()
        const mine = await book(resource.id, "10:00", "Asha")
        await book(resource.id, "14:00", "Ravi")

        await expectRejects(move(mine.attendee.id, "14:00"), /no longer available/i)
        await expectRejects(move(mine.attendee.id, "14:30"), /no longer available/i) // overlaps Ravi

        const after = await svc().retrieveAppointmentAttendee(mine.attendee.id)
        const slot = await svc().retrieveAppointment(mine.appointment.id)
        expect(after.reschedule_count).toBe(0)
        expect(after.status).toBe("confirmed")
        expect(new Date(slot.start_time).toISOString()).toBe(at("10:00").toISOString())
      })

      it("moves one person out of a group slot without disturbing the others", async () => {
        const resource = await makeResource(2)
        const asha = await book(resource.id, "10:00", "Asha", 2)
        const ravi = await book(resource.id, "10:00", "Ravi", 2)
        expect(asha.appointment.id).toBe(ravi.appointment.id)

        await move(asha.attendee.id, "13:00")

        const moved = await svc().retrieveAppointmentAttendee(asha.attendee.id)
        expect(moved.appointment_id).not.toBe(asha.appointment.id)
        const newSlot = await svc().retrieveAppointment(moved.appointment_id)
        expect(new Date(newSlot.start_time).toISOString()).toBe(at("13:00").toISOString())
        expect(newSlot.status).toBe("booked")

        const stayed = await svc().retrieveAppointmentAttendee(ravi.attendee.id)
        expect(stayed.status).toBe("confirmed")
        expect(stayed.appointment_id).toBe(asha.appointment.id)
        expect((await svc().retrieveAppointment(asha.appointment.id)).status).toBe("booked")
      })

      it("limits a buyer to two reschedules, but not the business", async () => {
        const resource = await makeResource()
        const { attendee } = await book(resource.id, "10:00")

        await move(attendee.id, "11:00", "buyer")
        await move(attendee.id, "12:00", "buyer")
        await expectRejects(move(attendee.id, "13:00", "buyer"), /maximum number of times/i)
        await move(attendee.id, "13:00", "vendor")

        const after = await svc().retrieveAppointmentAttendee(attendee.id)
        expect(after.reschedule_count).toBe(2) // the business move did not use one up
        expect(after.rescheduled_by).toBe("vendor")
      })

      it("leaves a held place behind when someone moves out of a group slot", async () => {
        const resource = await makeResource(2)
        const asha = await book(resource.id, "10:00", "Asha", 2)
        await svc().createAppointmentAttendees({
          appointment_id: asha.appointment.id,
          buyer_name: "Holder",
          status: "reserved",
          expires_at: new Date(Date.now() + 10 * 60_000),
        })

        await move(asha.attendee.id, "13:00")

        const old = await svc().retrieveAppointment(asha.appointment.id)
        expect(old.status).toBe("available") // only a hold is left, no longer a booking
        const holds = await svc().listAppointmentAttendees({ appointment_id: asha.appointment.id, status: "reserved" })
        expect(holds).toHaveLength(1)
      })

      it("holds a buyer to the same price but not the business", async () => {
        const resource = await makeResource(1, "vendor_price_test")
        // +20% from 14:00 to 18:00 (resource-local time; the resource is UTC).
        await svc().createPricingRules({
          vendor_id: "vendor_price_test",
          name: "Afternoon",
          type: "percent_adjust",
          value: 20,
          start_time: "14:00",
          end_time: "18:00",
        })
        const { attendee } = await book(resource.id, "10:00")

        await expectRejects(move(attendee.id, "15:00", "buyer"), /priced differently/i)
        await move(attendee.id, "11:00", "buyer") // same (no) rule: allowed
        await move(attendee.id, "15:00", "vendor") // the business decides

        const after = await svc().retrieveAppointmentAttendee(attendee.id)
        expect(after.reschedule_count).toBe(1)
      })

      it("will not move to the current time, nor move a cancelled booking", async () => {
        const resource = await makeResource()
        const { attendee } = await book(resource.id, "10:00")
        await expectRejects(move(attendee.id, "10:00"), /already at that time/i)

        await cancel(attendee.id)
        await expectRejects(move(attendee.id, "12:00"), /confirmed booking/i)
      })

      it("lists where a booking can move, including times that overlap its own slot", async () => {
        const resource = await makeResource()
        const { attendee } = await book(resource.id, "10:00")

        const { slots } = await svc().listRescheduleSlots({
          appointment_attendee_id: attendee.id,
          from: at("08:00"),
          to: at("18:00"),
          waiveNotice: true,
        })
        const starts = slots.map((s: any) => s.start.toISOString())
        expect(starts).toContain(at("10:30").toISOString())
        expect(starts).toContain(at("09:30").toISOString())
        expect(starts).not.toContain(at("10:00").toISOString())
      })
    })
  },
})
