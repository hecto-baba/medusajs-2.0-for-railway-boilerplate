import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import type { MedusaContainer } from '@medusajs/framework/types'
import { STOREFRONT_URL } from './constants'
import { sendEmail, type SendEmailResult } from './send-email'
import { toNumber } from './money'
import type { NoticeTemplateKey, NoticeTemplateProps } from '../modules/email-notifications/templates/notice'

type Container = Pick<MedusaContainer, 'resolve'>

/** "$12.00". Medusa v2 stores amounts in major units, as decimals. */
export const formatMoney = (amount: unknown, currencyCode?: string): string => {
  const value = toNumber(amount)
  const code = (currencyCode ?? '').toUpperCase()
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(value)
  } catch {
    return [value.toFixed(2), code].filter(Boolean).join(' ')
  }
}

export const greetingFor = (...names: Array<string | null | undefined>): string => {
  const name = names.filter(Boolean).join(' ').trim()
  return name ? `Dear ${name},` : 'Hello,'
}

export const formatDate = (value: unknown): string => {
  if (!value) return ''
  const date = new Date(value as any)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
}

export const countryCodeOf = (order: any): string =>
  String(
    order?.shipping_address?.country_code ||
      order?.billing_address?.country_code ||
      process.env.NEXT_PUBLIC_DEFAULT_REGION ||
      'gb'
  ).toLowerCase()

export const orderUrl = (order: any): string =>
  `${STOREFRONT_URL}/${countryCodeOf(order)}/account/orders/details/${order.id}`

export const cartUrl = (countryCode?: string): string =>
  `${STOREFRONT_URL}/${(countryCode || process.env.NEXT_PUBLIC_DEFAULT_REGION || 'gb').toLowerCase()}/cart`

export const orderLabel = (order: any): string =>
  order?.display_id ? `#${order.display_id}` : String(order?.id ?? '')

/** Loads what the emails about an order need, in one place. */
export const loadOrderForEmail = async (container: Container, orderId: string): Promise<any | null> => {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      'display_id',
      'email',
      'currency_code',
      'status',
      'metadata',
      'total',
      'customer.first_name',
      'customer.last_name',
      'shipping_address.first_name',
      'shipping_address.last_name',
      'shipping_address.country_code',
      'billing_address.first_name',
      'billing_address.last_name',
      'billing_address.country_code',
      'items.id',
      'items.title',
      'items.product_title',
      'items.quantity',
      'items.total',
    ],
    filters: { id: orderId },
  })
  return order ?? null
}

export const buyerGreeting = (order: any): string =>
  greetingFor(
    order?.customer?.first_name ?? order?.billing_address?.first_name ?? order?.shipping_address?.first_name,
    order?.customer?.last_name ?? order?.billing_address?.last_name ?? order?.shipping_address?.last_name
  )

/** The idempotency key of a notice email: `<template>:<resource id>[:<suffix>]`. */
export const noticeKey = (template: string, resourceId: string, keySuffix?: string): string =>
  [template, resourceId, keySuffix].filter(Boolean).join(':')

/**
 * Sends one of the notice-style emails. A thin wrapper so every subscriber
 * names its idempotency key the same way: `<template>:<resource id>[:<suffix>]`.
 */
export const sendNotice = async (
  container: Container,
  input: {
    template: NoticeTemplateKey
    to: string | null | undefined
    subject: string
    notice: NoticeTemplateProps
    resourceId: string
    resourceType?: string
    /** Makes the key distinct when one resource can send this email more than once. */
    keySuffix?: string
  }
): Promise<SendEmailResult> =>
  sendEmail(container, {
    template: input.template,
    to: input.to ?? '',
    subject: input.subject,
    data: input.notice as unknown as Record<string, unknown>,
    idempotencyKey: noticeKey(input.template, input.resourceId, input.keySuffix),
    resourceId: input.resourceId,
    resourceType: input.resourceType,
  })

/** The platform operator's address, for alerts only a person can act on. */
export const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL
