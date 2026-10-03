import AppointmentBookingModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const APPOINTMENT_BOOKING_MODULE = "appointment_booking"

export default Module(APPOINTMENT_BOOKING_MODULE, {
  service: AppointmentBookingModuleService,
})
