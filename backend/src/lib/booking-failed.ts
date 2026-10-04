import type { MedusaContainer } from '@medusajs/framework/types'
import { emitSafely } from './emit-safely'

export type BookingFailedEvent = {
  order_id: string
  kind: 'appointment' | 'ticket'
  /** What could not be secured, in words the buyer can read. */
  detail?: string
}

/**
 * Announces that a buyer PAID but the thing they paid for could not be secured
 * (an appointment time taken by someone else, a seat sold twice). Emitted just
 * before the step throws, so it goes out whether or not the workflow's
 * compensation later cancels the order. A subscriber emails the buyer and the
 * platform operator, who must issue the refund.
 *
 * Never throws: reporting must not hide the original failure.
 */
export const reportBookingFailure = (
  container: Pick<MedusaContainer, 'resolve'>,
  event: BookingFailedEvent
): Promise<void> => emitSafely(container, 'booking.failed', event)
