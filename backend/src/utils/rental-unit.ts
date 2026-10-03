export type RentalUnit = "hour" | "day" | "week" | "month" | "custom"

export const RENTAL_UNIT_DAY_SIZE: Record<Exclude<RentalUnit, "hour">, number> = {
  day: 1,
  week: 7,
  month: 30,
  custom: 1,
}
