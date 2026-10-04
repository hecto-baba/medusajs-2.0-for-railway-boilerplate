import { Modules } from '@medusajs/framework/utils'
import type { MedusaContainer } from '@medusajs/framework/types'

/**
 * Emits an event for a subscriber to act on (usually to send an email) without
 * ever failing the caller: the thing that happened has already happened, and a
 * broken event bus must not turn it into an error response.
 */
export const emitSafely = async (
  container: Pick<MedusaContainer, 'resolve'>,
  name: string,
  data: Record<string, unknown>
): Promise<void> => {
  try {
    const eventBus: any = container.resolve(Modules.EVENT_BUS)
    await eventBus.emit({ name, data })
  } catch (error: any) {
    console.error(`Could not emit ${name}:`, error?.message ?? error)
  }
}
