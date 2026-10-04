import {
  AppointmentChangedTemplate,
  isAppointmentChangedData,
} from "../../src/modules/email-notifications/templates/appointment-changed"
import { generateEmailTemplate } from "../../src/modules/email-notifications/templates"

// Rendering to HTML is async (the shared layout uses Tailwind) and needs
// `node --experimental-vm-modules`, which this suite does not run with, so the
// rendered output was checked separately; these cover the wiring.
describe("appointment-changed email", () => {
  const data = AppointmentChangedTemplate.PreviewProps

  it("accepts both kinds and rejects anything else", () => {
    expect(isAppointmentChangedData(data)).toBe(true)
    expect(isAppointmentChangedData({ ...data, kind: "cancelled" })).toBe(true)
    expect(isAppointmentChangedData({ ...data, kind: "nope" })).toBe(false)
    expect(isAppointmentChangedData({ kind: "cancelled" })).toBe(false)
  })

  it("is registered under its template key", () => {
    expect(generateEmailTemplate("appointment-changed", data)).toBeTruthy()
  })

  it("rejects bad data with a clear error", () => {
    expect(() => generateEmailTemplate("appointment-changed", { kind: "nope" })).toThrow(
      /Invalid data/
    )
  })
})
