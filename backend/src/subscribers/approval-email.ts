import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { STOREFRONT_URL } from '../lib/constants'
import { formatMoney, greetingFor, sendNotice } from '../lib/email-notice'

type Payload = { approval_id: string; status?: 'approved' | 'rejected'; approval_status_id?: string }

const accountUrl = (path: string) =>
  `${STOREFRONT_URL}/${(process.env.NEXT_PUBLIC_DEFAULT_REGION || 'gb').toLowerCase()}/account/${path}`

const loadApproval = async (query: any, approvalId: string) => {
  const {
    data: [approval],
  } = await query.graph({
    entity: 'approval',
    fields: ['id', 'cart_id', 'created_by', 'cart.total', 'cart.currency_code'],
    filters: { id: approvalId },
  })
  return approval ?? null
}

const loadCustomer = async (query: any, customerId: string) => {
  const {
    data: [customer],
  } = await query.graph({
    entity: 'customer',
    fields: ['id', 'email', 'first_name', 'last_name', 'employee.is_admin', 'employee.company.id', 'employee.company.name'],
    filters: { id: customerId },
  })
  return customer ?? null
}

/** A manager approved or rejected: tell the employee who asked. */
const notifyEmployee = async (container: any, query: any, data: Payload) => {
  const approval = await loadApproval(query, data.approval_id)
  if (!approval) return
  const employee = await loadCustomer(query, approval.created_by)
  if (!employee?.email || !data.status) return

  const approved = data.status === 'approved'
  const amount = formatMoney(approval.cart?.total, approval.cart?.currency_code)

  await sendNotice(container, {
    template: 'approval-decided',
    to: employee.email,
    subject: approved ? 'Your purchase request was approved' : 'Your purchase request was declined',
    resourceId: approval.id,
    resourceType: 'approval',
    // A request can be decided more than once (rejected, then approved), so the
    // status record, not the approval, identifies this email.
    keySuffix: data.approval_status_id ?? data.status,
    notice: {
      heading: approved ? 'Your request was approved' : 'Your request was declined',
      greeting: greetingFor(employee.first_name, employee.last_name),
      paragraphs: approved
        ? ['Your manager approved your purchase request. You can now go to your cart and place the order.']
        : ['Your manager declined your purchase request, so the order cannot be placed. Speak to your manager if you have questions.'],
      rows: [{ label: 'Order value', value: amount }],
      button: approved ? { label: 'Go to your cart', url: `${STOREFRONT_URL}/${(process.env.NEXT_PUBLIC_DEFAULT_REGION || 'gb').toLowerCase()}/cart` } : undefined,
    },
  })
}

/** An employee asked for approval: tell the managers of their company. */
const notifyManagers = async (container: any, query: any, data: Payload) => {
  const approval = await loadApproval(query, data.approval_id)
  if (!approval) return
  const employee = await loadCustomer(query, approval.created_by)
  const companyId = employee?.employee?.company?.id
  if (!companyId) return

  const { data: employees } = await query.graph({
    entity: 'employee',
    fields: ['customer_id'],
    filters: { company_id: companyId, is_admin: true },
  })
  const managerIds = ((employees ?? []) as any[]).map((e) => e.customer_id).filter(Boolean)
  if (!managerIds.length) return

  const { data: managers } = await query.graph({
    entity: 'customer',
    fields: ['id', 'email', 'first_name', 'last_name'],
    filters: { id: managerIds },
  })

  const who = [employee.first_name, employee.last_name].filter(Boolean).join(' ') || employee.email || 'An employee'
  const amount = formatMoney(approval.cart?.total, approval.cart?.currency_code)

  for (const manager of (managers ?? []) as any[]) {
    if (!manager.email) continue
    await sendNotice(container, {
      template: 'approval-requested',
      to: manager.email,
      subject: `${who} is asking for your approval`,
      resourceId: approval.id,
      resourceType: 'approval',
      keySuffix: manager.id,
      notice: {
        heading: 'A purchase needs your approval',
        greeting: greetingFor(manager.first_name, manager.last_name),
        paragraphs: [`${who} has asked to place an order and needs a manager to approve it.`],
        rows: [
          { label: 'Requested by', value: who },
          { label: 'Order value', value: amount },
        ],
        button: { label: 'Review the request', url: accountUrl('approvals') },
      },
    })
  }
}

export default async function approvalEmailHandler({ event, container }: SubscriberArgs<Payload>) {
  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    if (event.name === 'approval.requested') {
      await notifyManagers(container, query, event.data)
    } else {
      await notifyEmployee(container, query, event.data)
    }
  } catch (error: any) {
    console.error(`Error handling ${event.name} email:`, error?.message ?? error)
  }
}

export const config: SubscriberConfig = {
  event: ['approval.requested', 'approval.decided'],
  context: { subscriberId: 'approval-email' },
}
