import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { APPOINTMENT_BOOKING_MODULE } from "../../../src/modules/appointment-booking"
import { signCancelToken } from "../../../src/modules/appointment-booking/lib/cancel-token"
import { onboardingStore } from "../../../src/lib/onboarding-store"
import { call, createTestVendor, TestVendor } from "../helpers/vendors"
import { setUpStorefront } from "../helpers/checkout"

jest.setTimeout(10 * 60 * 1000)

const PRODUCT = "prod_http_test"
const DAY = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)
const at = (hhmm: string) => new Date(`${DAY}T${hhmm}:00.000Z`)

/**
 * The HTTP surface of cancel and reschedule: who may call each route, that the
 * wrong caller gets the same 404 as a missing booking, that bad input and
 * refused moves are 4xx (never a 500), and that the happy path works through the
 * real middleware.
 */
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("cancel and reschedule over HTTP", () => {
      let store: { headers: Record<string, string> }
      let sellerA: TestVendor
      let sellerB: TestVendor
      let adminHeaders: { headers: { authorization: string } }
      let n = 0

      const svc = () => getContainer().resolve(APPOINTMENT_BOOKING_MODULE) as any

      beforeAll(async () => {
        const container = getContainer()
        store = (await setUpStorefront(container)).storeHeaders

        sellerA = await createTestVendor(api, "a")
        sellerB = await createTestVendor(api, "b")
        onboardingStore.approve(sellerA.vendorId)
        onboardingStore.approve(sellerB.vendorId)

        const userModule = container.resolve(Modules.USER) as any
        const authModule = container.resolve(Modules.AUTH) as any
        await api.post("/auth/user/emailpass/register", { email: "admin@changes.test", password: "supersecret-Test-1" })
        const user = await userModule.createUsers({ email: "admin@changes.test" })
        const identity = (await authModule.listAuthIdentities({ provider_identities: { entity_id: "admin@changes.test" } }))[0]
        await authModule.updateAuthIdentities({ id: identity.id, app_metadata: { user_id: user.id } })
        const login: any = await api.post("/auth/user/emailpass", { email: "admin@changes.test", password: "supersecret-Test-1" })
        adminHeaders = { headers: { authorization: `Bearer ${login.data.token}` } }
      })

      // A fresh resource (owned by seller A) with one confirmed booking at 10:00.
      const makeBooking = async (vendorId = sellerA.vendorId, hhmm = "10:00") => {
        const service = svc()
        const resource = await service.createProviders({
          vendor_id: vendorId,
          display_name: `Room ${++n}`,
          timezone: "UTC",
          session_duration_minutes: 60,
          slot_step_minutes: 30,
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
        const appointment = await service.createAppointments({
          provider_id: resource.id,
          service_product_id: PRODUCT,
          service_variant_id: "variant_test",
          start_time: at(hhmm),
          end_time: new Date(at(hhmm).getTime() + 3_600_000),
          max_capacity: 1,
          status: "booked",
        })
        const attendee = await service.createAppointmentAttendees({
          appointment_id: appointment.id,
          buyer_name: "Asha",
          buyer_email: "asha@example.com",
          status: "confirmed",
        })
        return { resource, appointment, attendee, token: signCancelToken(attendee.id) }
      }

      const path = (id: string, tail = "") => `/store/appointments/bookings/${id}${tail}`

      describe("buyer, by signed link", () => {
        it("a booking cannot be read, listed or moved without its token, or with another booking's", async () => {
          const one = await makeBooking()
          const two = await makeBooking()
          const body = { start: at("12:00").toISOString() }

          expect((await call(api.get(path(one.attendee.id), store))).status).toBe(404)
          expect((await call(api.get(path(one.attendee.id) + "?token=nonsense", store))).status).toBe(404)
          expect((await call(api.get(path(one.attendee.id) + `?token=${two.token}`, store))).status).toBe(404)
          expect((await call(api.post(path(one.attendee.id, "/reschedule"), body, store))).status).toBe(404)
          expect((await call(api.post(path(one.attendee.id, "/reschedule") + `?token=${two.token}`, body, store))).status).toBe(404)
          expect(
            (await call(api.get(path(one.attendee.id, "/slots") + `?from=${at("08:00").toISOString()}&to=${at("18:00").toISOString()}`, store))).status
          ).toBe(404)
          expect((await call(api.post(path(one.attendee.id, "/cancel"), {}, store))).status).toBe(404)

          // Nothing moved or cancelled.
          const after = await svc().retrieveAppointmentAttendee(one.attendee.id)
          expect(after.status).toBe("confirmed")
          expect(after.reschedule_count).toBe(0)
        })

        it("shows what can be done, and a move through the link works", async () => {
          const b = await makeBooking()
          const view = await call(api.get(path(b.attendee.id) + `?token=${b.token}`, store))
          expect(view.status).toBe(200)
          expect(view.data.booking.can_reschedule).toBe(true)
          expect(view.data.booking.reschedules_left).toBe(2)

          const slots = await call(
            api.get(path(b.attendee.id, "/slots") + `?token=${b.token}&from=${at("08:00").toISOString()}&to=${at("18:00").toISOString()}`, store)
          )
          expect(slots.status).toBe(200)
          const starts = slots.data.slots.map((s: any) => s.start)
          expect(starts).toContain(at("10:30").toISOString())
          expect(starts).not.toContain(at("10:00").toISOString())

          const moved = await call(
            api.post(path(b.attendee.id, "/reschedule") + `?token=${b.token}`, { start: at("12:00").toISOString() }, store)
          )
          expect(moved.status).toBe(200)

          const after = await call(api.get(path(b.attendee.id) + `?token=${b.token}`, store))
          expect(new Date(after.data.booking.start_time).toISOString()).toBe(at("12:00").toISOString())
          expect(after.data.booking.reschedules_left).toBe(1)
          expect(new Date(after.data.booking.rescheduled_from_start).toISOString()).toBe(at("10:00").toISOString())
        })

        it("bad input and refused moves are 4xx with a message, never a 500", async () => {
          const b = await makeBooking()
          const other = await makeBooking(sellerB.vendorId, "14:00")
          const url = path(b.attendee.id, "/reschedule") + `?token=${b.token}`

          expect((await call(api.post(url, {}, store))).status).toBe(400)
          expect((await call(api.post(url, { start: "not a date" }, store))).status).toBe(400)

          // Its own current time, an off-grid time, and a time outside opening hours.
          for (const start of [at("10:00"), at("12:07"), at("20:00")]) {
            const res = await call(api.post(url, { start: start.toISOString() }, store))
            expect(res.status).toBeGreaterThanOrEqual(400)
            expect(res.status).toBeLessThan(500)
            expect(typeof res.data.message).toBe("string")
          }
          expect(other.attendee.id).toBeTruthy()
        })

        it("cancels through the link, and a second cancel is a 4xx, not a 500", async () => {
          const b = await makeBooking()
          const url = path(b.attendee.id, "/cancel") + `?token=${b.token}`
          expect((await call(api.post(url, {}, store))).status).toBe(200)
          const again = await call(api.post(url, {}, store))
          expect(again.status).toBeGreaterThanOrEqual(400)
          expect(again.status).toBeLessThan(500)

          // A cancelled booking can no longer be moved either.
          const moved = await call(api.post(path(b.attendee.id, "/reschedule") + `?token=${b.token}`, { start: at("12:00").toISOString() }, store))
          expect(moved.status).toBeGreaterThanOrEqual(400)
          expect(moved.status).toBeLessThan(500)
        })
      })

      describe("seller", () => {
        it("a seller cannot see, move or cancel another seller's booking (404), and the booking is untouched", async () => {
          const b = await makeBooking(sellerA.vendorId)
          const body = { start: at("12:00").toISOString() }
          const range = `from=${at("08:00").toISOString()}&to=${at("18:00").toISOString()}`

          expect((await call(api.post(`/vendors/appointments/${b.attendee.id}/reschedule`, body, sellerB.headers))).status).toBe(404)
          expect((await call(api.get(`/vendors/appointments/${b.attendee.id}/reschedule-slots?${range}`, sellerB.headers))).status).toBe(404)
          expect((await call(api.post(`/vendors/appointments/${b.attendee.id}/cancel`, { reason: "x" }, sellerB.headers))).status).toBe(404)

          const after = await svc().retrieveAppointmentAttendee(b.attendee.id)
          expect(after.status).toBe("confirmed")
          expect(after.reschedule_count).toBe(0)
        })

        it("requires a seller login", async () => {
          const b = await makeBooking()
          const res = await call(api.post(`/vendors/appointments/${b.attendee.id}/reschedule`, { start: at("12:00").toISOString() }))
          expect([401, 403]).toContain(res.status)
        })

        it("the owner can list free times and move the booking, with no buyer limits", async () => {
          const b = await makeBooking(sellerA.vendorId)
          const range = `from=${at("08:00").toISOString()}&to=${at("18:00").toISOString()}`
          const slots = await call(api.get(`/vendors/appointments/${b.attendee.id}/reschedule-slots?${range}`, sellerA.headers))
          expect(slots.status).toBe(200)
          expect(slots.data.slots.map((s: any) => s.start)).toContain(at("10:30").toISOString())

          for (const hhmm of ["11:00", "12:00", "13:00"]) {
            const res = await call(
              api.post(`/vendors/appointments/${b.attendee.id}/reschedule`, { start: at(hhmm).toISOString(), notify: false }, sellerA.headers)
            )
            expect(res.status).toBe(200)
          }
          const after = await svc().retrieveAppointmentAttendee(b.attendee.id)
          expect(after.reschedule_count).toBe(0)
          expect(after.rescheduled_by).toBe("vendor")
        })

        it("the owner can cancel without emailing the customer", async () => {
          const b = await makeBooking(sellerA.vendorId)
          const res = await call(
            api.post(`/vendors/appointments/${b.attendee.id}/cancel`, { reason: "Stylist unwell", notify: false }, sellerA.headers)
          )
          expect(res.status).toBe(200)
          const after = await svc().retrieveAppointmentAttendee(b.attendee.id)
          expect(after.status).toBe("cancelled")
          expect(after.cancelled_by).toBe("vendor")
          expect(after.cancellation_sent_at).toBeNull()
        })

        it("a cancel needs a reason", async () => {
          const b = await makeBooking(sellerA.vendorId)
          expect((await call(api.post(`/vendors/appointments/${b.attendee.id}/cancel`, {}, sellerA.headers))).status).toBe(400)
        })
      })

      describe("admin", () => {
        it("an admin can list free times, move and cancel any booking; a seller token is refused", async () => {
          const b = await makeBooking(sellerA.vendorId)
          const range = `from=${at("08:00").toISOString()}&to=${at("18:00").toISOString()}`

          const refused = await call(api.post(`/admin/appointments/${b.attendee.id}/reschedule`, { start: at("12:00").toISOString() }, sellerA.headers))
          expect([401, 403]).toContain(refused.status)

          const slots = await call(api.get(`/admin/appointments/${b.attendee.id}/reschedule-slots?${range}`, adminHeaders))
          expect(slots.status).toBe(200)
          expect(slots.data.slots.map((s: any) => s.start)).toContain(at("10:30").toISOString())

          const moved = await call(
            api.post(`/admin/appointments/${b.attendee.id}/reschedule`, { start: at("12:00").toISOString(), notify: false }, adminHeaders)
          )
          expect(moved.status).toBe(200)
          expect((await svc().retrieveAppointmentAttendee(b.attendee.id)).rescheduled_by).toBe("admin")

          const cancelled = await call(
            api.post(`/admin/appointments/${b.attendee.id}/cancel`, { reason: "Closed", notify: false }, adminHeaders)
          )
          expect(cancelled.status).toBe(200)
          expect((await svc().retrieveAppointmentAttendee(b.attendee.id)).status).toBe("cancelled")
        })

        it("an unknown booking is a 404", async () => {
          expect((await call(api.post(`/admin/appointments/does_not_exist/reschedule`, { start: at("12:00").toISOString() }, adminHeaders))).status).toBe(404)
        })
      })
    })
  },
})
